/**
 * C# Language Plugin for Multi-Language Code Generation
 * Generates C# code from JavaScript AST using AST Pipeline
 *
 * Follows the LanguagePlugin specification exactly
 *
 * Uses AST pipeline exclusively: JS AST -> C# AST -> C# Emitter
 */

// Import the framework (Node.js environment)
(function() {
  // Use local variables to avoid global conflicts
  let LanguagePlugin, LanguagePlugins;
  let CSharpAST, CSharpEmitter, CSharpTransformer;
  let SharedTypeAwareParser = null;

if (typeof require !== 'undefined') {
  // Node.js environment
  const framework = require('./LanguagePlugin.js');
  LanguagePlugin = framework.LanguagePlugin;
  LanguagePlugins = framework.LanguagePlugins;

  // Load AST pipeline components (required)
  try {
    CSharpAST = require('./CSharpAST.js');
    const emitterModule = require('./CSharpEmitter.js');
    CSharpEmitter = emitterModule.CSharpEmitter;
    const transformerModule = require('./CSharpTransformer.js');
    CSharpTransformer = transformerModule.CSharpTransformer;
  } catch (e) {
    console.error('Failed to load C# AST pipeline components:', e.message);
    throw new Error('C# plugin requires CSharpAST, CSharpEmitter, and CSharpTransformer');
  }

  // Best-effort: pick up the shared OpCodes/framework JSDoc type knowledge that
  // TypeAwareJSASTParser builds once per process (TypeAwareJSASTParser.sharedTypeKnowledge)
  // as a fallback for callers that transpile straight from an already-parsed IL AST
  // without also threading the parser/typeKnowledge option through GenerateFromAST() -
  // without it, CSharpTransformer.getOpCodesReturnType() has nothing to consult and every
  // OpCodes.* helper (GF256Mul, GetByte, PopCountFast, ...) silently returns Object(),
  // which then skips numeric narrowing-cast insertion on assignment (CS0266/CS0029).
  try {
    SharedTypeAwareParser = require('../type-aware-transpiler.js').TypeAwareJSASTParser;
  } catch (e) {
    // Non-fatal - typeKnowledge fallback simply won't be available.
  }
} else {
  // Browser environment - use globals
  LanguagePlugin = window.LanguagePlugin;
  LanguagePlugins = window.LanguagePlugins;
  CSharpAST = window.CSharpAST;
  CSharpEmitter = window.CSharpEmitter;
  CSharpTransformer = window.CSharpTransformer;
  SharedTypeAwareParser = window.TypeAwareJSASTParser || null;
}

/**
 * C# Code Generator Plugin
 * Extends LanguagePlugin base class
 */
class CSharpPlugin extends LanguagePlugin {
  constructor() {
    super();

    // Required plugin metadata
    this.name = 'C#';
    this.extension = 'cs';
    this.icon = '🔷';
    this.description = 'C# language code generator';
    this.mimeType = 'text/x-csharp';
    this.version = '.NET 8.0+';

    // C#-specific options
    this.options = {
      indent: '    ', // 4 spaces (C# convention)
      lineEnding: '\n',
      addComments: true,
      useStrictTypes: true,
      namespace: 'CipherValidation',  // Must match framework stubs namespace
      className: 'GeneratedClass',
      useNullableTypes: true
    };
  }

  /**
   * Generate C# code from Abstract Syntax Tree using AST Pipeline
   * Pipeline: JS AST -> C# AST (via CSharpTransformer) -> C# Source (via CSharpEmitter)
   * @param {Object} ast - Parsed/Modified AST representation
   * @param {Object} options - Generation options
   * @returns {CodeGenerationResult}
   */
  GenerateFromAST(ast, options = {}) {
    // Save original options
    const originalOptions = this.options;

    try {
      // Merge options with defaults
      const mergedOptions = { ...this.options, ...options };
      this.options = mergedOptions;

      // Validate AST
      if (!ast || typeof ast !== 'object') {
        return this.CreateErrorResult('Invalid AST: must be an object');
      }

      // Verify pipeline components are available
      if (!CSharpTransformer || !CSharpEmitter) {
        return this.CreateErrorResult('C# AST pipeline components not available');
      }

      // Create transformer with options
      const transformer = new CSharpTransformer({
        namespace: mergedOptions.namespace || 'CipherValidation',
        className: mergedOptions.className || 'GeneratedClass',
        typeKnowledge: mergedOptions.parser?.typeKnowledge || mergedOptions.typeKnowledge ||
          SharedTypeAwareParser?.sharedTypeKnowledge || null
      });

      // Transform JS AST to C# AST
      const csAst = transformer.transform(ast);

      // Create emitter with formatting options
      const emitter = new CSharpEmitter({
        indent: mergedOptions.indent || '    ',
        lineEnding: mergedOptions.lineEnding || '\n'
      });

      // Emit C# source code
      let code = emitter.emit(csAst);

      // Add framework type stubs if needed
      if (mergedOptions.generateFrameworkStubs !== false) {
        code = this._addFrameworkStubs(code, mergedOptions.namespace || 'CipherValidation');
      }

      // Collect any warnings from transformation
      const warnings = transformer.warnings || [];

      return this.CreateSuccessResult(code, [], warnings);

    } catch (error) {
      return this.CreateErrorResult('C# code generation failed: ' + error.message);
    } finally {
      // Restore original options
      this.options = originalOptions;
    }
  }

  /**
   * Validate C# code syntax using .NET compiler or basic validation
   * @param {string} code - C# source code to validate
   * @returns {Object} Validation result with success, method, and error
   */
  ValidateCodeSyntax(code) {
    // Check if .NET compiler is available first
    const dotnetAvailable = this._isDotnetAvailable();
    if (!dotnetAvailable) {
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : '.NET compiler not available - using basic validation'
      };
    }

    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');

      // Create temporary file
      const tempFile = path.join(__dirname, '..', '.agent.tmp', `TempCSharpClass_${Date.now()}.cs`);

      // Ensure .agent.tmp directory exists
      const tempDir = path.dirname(tempFile);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Wrap code in a basic class structure if needed
      let csharpCode = code;
      if (!code.includes('class ') && !code.includes('interface ') && !code.includes('struct ') && !code.includes('namespace ')) {
        const className = path.basename(tempFile, '.cs');
        csharpCode = `using System;\n\npublic class ${className} {\n${code}\n}`;
      }

      // Write code to temp file
      fs.writeFileSync(tempFile, csharpCode);

      try {
        let compileCommand;
        if (dotnetAvailable === 'csc') {
          // Use Framework compiler
          compileCommand = `csc /t:library /nologo "${tempFile}"`;
        } else {
          // Use .NET Core/5+ compiler via dotnet build
          // Create a minimal project file
          const projectFile = path.join(path.dirname(tempFile), `${path.basename(tempFile, '.cs')}.csproj`);
          const projectContent = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Library</OutputType>
    <TargetFramework>net6.0</TargetFramework>
  </PropertyGroup>
</Project>`;
          fs.writeFileSync(projectFile, projectContent);
          compileCommand = `dotnet build "${projectFile}" --verbosity quiet`;
        }

        // Try to compile the C# code
        execSync(compileCommand, {
          stdio: 'pipe',
          timeout: 3000,
          cwd: path.dirname(tempFile),
          windowsHide: true  // Prevent Windows error dialogs
        });

        // Clean up files
        fs.unlinkSync(tempFile);

        // Clean up additional files created by dotnet build
        const baseFileName = path.basename(tempFile, '.cs');
        const tempDir = path.dirname(tempFile);
        [
          path.join(tempDir, `${baseFileName}.csproj`),
          path.join(tempDir, `${baseFileName}.dll`),
          path.join(tempDir, `${baseFileName}.exe`),
          path.join(tempDir, `${baseFileName}.pdb`)
        ].forEach(file => {
          if (fs.existsSync(file)) {
            try { fs.unlinkSync(file); } catch (e) { /* ignore */ }
          }
        });

        // Clean up bin/obj folders if they exist
        ['bin', 'obj'].forEach(dir => {
          const dirPath = path.join(tempDir, dir);
          if (fs.existsSync(dirPath)) {
            try { fs.rmSync(dirPath, { recursive: true }); } catch (e) { /* ignore */ }
          }
        });

        return {
          success: true,
          method: dotnetAvailable === 'csc' ? 'csc' : 'dotnet',
          error: null
        };

      } catch (error) {
        // Clean up on error
        const baseFileName = path.basename(tempFile, '.cs');
        const tempDir = path.dirname(tempFile);

        [
          tempFile,
          path.join(tempDir, `${baseFileName}.csproj`),
          path.join(tempDir, `${baseFileName}.dll`),
          path.join(tempDir, `${baseFileName}.exe`),
          path.join(tempDir, `${baseFileName}.pdb`)
        ].forEach(file => {
          if (fs.existsSync(file)) {
            try { fs.unlinkSync(file); } catch (e) { /* ignore */ }
          }
        });

        return {
          success: false,
          method: dotnetAvailable === 'csc' ? 'csc' : 'dotnet',
          error: error.stderr?.toString() || error.message
        };
      }

    } catch (error) {
      // If .NET compiler is not available or other error, fall back to basic validation
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : '.NET compiler not available - using basic validation'
      };
    }
  }

  /**
   * Get .NET compiler download information
   * @returns {Object} Compiler information including name, download URL, and instructions
   */
  GetCompilerInfo() {
    return {
      name: this.name,
      compilerName: '.NET SDK',
      downloadUrl: 'https://dotnet.microsoft.com/download',
      installInstructions: [
        'Download .NET SDK from https://dotnet.microsoft.com/download',
        'Install the SDK package for your operating system',
        'Verify installation with: dotnet --version',
        'Alternative: Use Visual Studio with C# support',
        'Legacy: .NET Framework with csc.exe compiler'
      ].join('\n'),
      verifyCommand: 'dotnet --version',
      alternativeValidation: 'Basic syntax checking (balanced brackets/parentheses with C# generics)',
      packageManager: 'NuGet',
      documentation: 'https://docs.microsoft.com/en-us/dotnet/csharp/'
    };
  }

  /**
   * Check if .NET compiler is available
   * @private
   * @returns {string|boolean} 'dotnet', 'csc', or false if not available
   */
  _isDotnetAvailable() {
    try {
      const { execSync } = require('child_process');

      // Try dotnet first (cross-platform)
      try {
        execSync('dotnet --version', { stdio: 'pipe', timeout: 2000, windowsHide: true });
        return 'dotnet';
      } catch (e) {
        // Try csc (Framework compiler on Windows)
        try {
          execSync('csc /help', { stdio: 'pipe', timeout: 2000, windowsHide: true });
          return 'csc';
        } catch (e2) {
          return false;
        }
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Basic syntax validation by checking balanced delimiters
   * Handles C# generics (e.g., List<int>, Dictionary<string, object>)
   * @private
   * @param {string} code - C# source code
   * @returns {boolean} True if basic syntax checks pass
   */
  _checkBalancedSyntax(code) {
    const stack = [];
    const pairs = { '{': '}', '[': ']', '(': ')' };
    const closers = new Set(['}', ']', ')']);

    // Remove strings and comments to avoid false positives
    let cleanedCode = code
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')  // Remove string contents
      .replace(/'(?:[^'\\]|\\.)*'/g, "''")  // Remove char contents
      .replace(/\/\/.*$/gm, '')              // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '');    // Remove multi-line comments

    // Handle C# generics - temporarily replace angle brackets in generic declarations
    // Pattern: Type<...> where Type starts with uppercase or is a known generic type
    cleanedCode = cleanedCode.replace(/\b[A-Z]\w*<[^>]+>/g, (match) => {
      // Count nested generics properly
      let depth = 0;
      let result = match[0];
      for (let i = 1; i < match.length; i++) {
        if (match[i] === '<') depth++;
        else if (match[i] === '>') {
          depth--;
          if (depth === 0) {
            // This is the matching closing bracket for the generic
            result += match.substring(1, i);
            break;
          }
        }
      }
      return result.replace(/[<>]/g, '');  // Remove angle brackets from generics
    });

    for (let i = 0; i < cleanedCode.length; i++) {
      const char = cleanedCode[i];

      if (char in pairs) {
        stack.push(pairs[char]);
      } else if (closers.has(char)) {
        if (stack.length === 0 || stack.pop() !== char) {
          return false;  // Unbalanced or mismatched
        }
      }
    }

    return stack.length === 0;  // All delimiters should be matched
  }

  /**
   * Add framework type stubs to generated C# code for compilation
   * @private
   * @param {string} code - Generated C# code
   * @param {string} namespace - Target namespace
   * @returns {string} Code with framework stubs and proper using statement ordering
   */
  _addFrameworkStubs(code, namespace) {
    // Extract all using statements from the code
    const usingRegex = /^using\s+[^;]+;\s*$/gm;
    const usings = new Set();
    let match;
    while ((match = usingRegex.exec(code)) !== null) {
      usings.add(match[0].trim());
    }

    // Add required system usings
    usings.add('using System;');
    usings.add('using System.Collections.Generic;');
    usings.add('using System.Linq;');
    usings.add('using System.Numerics;');

    // Remove using statements from the original code
    const codeWithoutUsings = code.replace(usingRegex, '').replace(/^\s*\n/gm, '');

    // Build the using statements block
    const usingBlock = Array.from(usings).sort().join('\n');

    const stubs = `// Framework Type Stubs for Compilation
// These minimal stubs allow generated code to compile standalone

namespace ${namespace}
{
    // Enums
    // Members beyond AlgorithmFramework.js's own Object.freeze({...}) definitions are
    // additional values individual algorithm .js files reference that don't actually
    // exist in the real JS enum either (harmless there - property access on a frozen
    // object just silently reads undefined). C# has no equivalent of a silently-missing
    // enum member (CS0117), so ComplexityType's extras are declared as aliases of the
    // nearest real level rather than left out, keeping metadata
    // (Complexity/Category/SecurityStatus, ...) meaningful. Algorithm files are out of
    // scope to edit this round, so the stub absorbs the mismatch instead.
    public enum CategoryType { CHECKSUM, BLOCK, STREAM, HASH, MAC, KDF, AEAD, ASYMMETRIC, COMPRESSION, ENCODING, CLASSICAL, ECC, RANDOM, MODES, MODE, CRYPTO, SPECIAL, PADDING, PQC }
    public enum SecurityStatus { SECURE, EDUCATIONAL, DEPRECATED, BROKEN, EXPERIMENTAL, OBSOLETE, INSECURE, ACTIVE }
    public enum CountryCode { US, DE, JP, FR, GB, CN, RU, BE, KR, IL, CH, AU, NL, AT, FI, SE, NO, DK, IT, ES, CA, OTHER, INTERNATIONAL, ANCIENT, AUSTRIA, BR, CR, EU, FRANCE, GR, ID, IN, INT, INTL, MULTI, NETHERLANDS, PL, PT, SG, SINGAPORE, TR, UA, UK, UNKNOWN, ZA }
    public enum ComplexityType { BEGINNER, INTERMEDIATE, ADVANCED, EXPERT, RESEARCH, BASIC = BEGINNER, ELEMENTARY = BEGINNER, TRIVIAL = BEGINNER, SIMPLE = BEGINNER, LOW = BEGINNER, MEDIUM = INTERMEDIATE, HIGH = ADVANCED }

    // Base classes
    public class Algorithm
    {
        public string Name { get; set; }
        public string Description { get; set; }
        public string Inventor { get; set; }
        public int Year { get; set; }
        public CategoryType Category { get; set; }
        public string SubCategory { get; set; }
        public SecurityStatus SecurityStatus { get; set; }
        public ComplexityType Complexity { get; set; }
        public CountryCode? Country { get; set; }
        public LinkItem[] Documentation { get; set; }
        public LinkItem[] References { get; set; }
        public Vulnerability[] KnownVulnerabilities { get; set; }
        public TestCase[] Tests { get; set; }
        public dynamic Config { get; set; }
        public int ChecksumSize { get; set; }
        public string[] Notes { get; set; }
        public KeySize[] SupportedKeySizes { get; set; }
        public KeySize[] SupportedBlockSizes { get; set; }
        // Common properties that may be used by derived classes
        public int OutputSize { get; set; }
        public int BlockSize { get; set; }
        public dynamic INITIAL_HASH { get; set; }
        public virtual object CreateInstance(bool isInverse = false) { return null; }
    }

    // Error correction algorithm base class
    public abstract class ErrorCorrectionAlgorithm : Algorithm
    {
        public int CodeLength { get; set; }
        public int MessageLength { get; set; }
        public int MinimumDistance { get; set; }
    }

    // Algorithm type base classes - hierarchy matches AlgorithmFramework.js
    public abstract class CryptoAlgorithm : Algorithm { }
    public abstract class SymmetricCipherAlgorithm : CryptoAlgorithm { }
    public abstract class AsymmetricCipherAlgorithm : CryptoAlgorithm { }
    public abstract class BlockCipherAlgorithm : SymmetricCipherAlgorithm { }
    public abstract class StreamCipherAlgorithm : SymmetricCipherAlgorithm { }
    // Property types below marked dynamic mirror AlgorithmFramework.js fields whose
    // JS constructors initialize them to [] (JSDoc says KeySize[], but real algorithm
    // files assign wildly inconsistent shapes at the concrete-subclass level: KeySize[],
    // plain int[], object-literal arrays {minSize,maxSize,stepSize}, or null) - a fixed
    // element type here would make one shape compile and the rest CS0029/CS1503. dynamic
    // accepts any of them without a cast, matching JS's own untyped-property semantics.
    public abstract class HashFunctionAlgorithm : Algorithm { public int DigestSize { get; set; } public int OutputSize { get; set; } public int BlockSize { get; set; } public dynamic SupportedOutputSizes { get; set; } }
    public abstract class AeadAlgorithm : CryptoAlgorithm { public dynamic SupportedTagSizes { get; set; } public bool SupportsDetached { get; set; } }
    public abstract class MacAlgorithm : Algorithm { public dynamic SupportedMacSizes { get; set; } public bool NeedsKey { get; set; } }
    public abstract class KdfAlgorithm : Algorithm { public bool SaltRequired { get; set; } public dynamic SupportedOutputSizes { get; set; } }
    public abstract class ChecksumAlgorithm : Algorithm { }
    public abstract class CompressionAlgorithm : Algorithm { }
    public abstract class RandomAlgorithm : Algorithm { }
    public abstract class RandomGenerationAlgorithm : Algorithm { public bool IsDeterministic { get; set; } public bool IsCryptographicallySecure { get; set; } public dynamic SupportedSeedSizes { get; set; } }
    public abstract class ClassicalCipherAlgorithm : Algorithm { }
    public abstract class EncodingAlgorithm : Algorithm { }
    public abstract class AsymmetricAlgorithm : Algorithm { }
    public abstract class PaddingAlgorithm : Algorithm { public bool IsLengthIncluded { get; set; } }
    public abstract class PermutationAlgorithm : Algorithm { }
    public abstract class ModeAlgorithm : Algorithm { }
    public abstract class CipherModeAlgorithm : Algorithm { public bool RequiresIV { get; set; } public dynamic SupportedIVSizes { get; set; } }
    public abstract class CryptoWrapAlgorithm : Algorithm { }
    public abstract class SpecialAlgorithm : Algorithm { }

    public abstract class IAlgorithmInstance
    {
        protected Algorithm algorithm;
        public Algorithm Algorithm { get => algorithm; protected set => algorithm = value; }
        public dynamic Config { get; set; }
        public dynamic A { get; set; }
        public dynamic B { get; set; }
        // Common properties - all algorithm instances may use these
        public byte[] Key { get; set; }
        public byte[] IV { get; set; }
        public byte[] Iv { get => IV; set => IV = value; }
        public byte[] Nonce { get; set; }
        public byte[] Seed { get; set; }
        public int OutputSize { get; set; }
        public int OutputLength { get; set; }
        public byte[] Salt { get; set; }
        public int Iterations { get; set; }
        public byte[] PublicKey { get; set; }
        public byte[] PrivateKey { get; set; }
        public dynamic UnderlyingCipher { get; set; }
        protected IAlgorithmInstance(Algorithm algo) { algorithm = algo; }
        // Some algorithm sources call the JS super() with NO arguments and instead
        // assign this.algorithm = algorithm as a separate statement in the subclass
        // constructor body (semantically identical to passing it straight through -
        // e.g. block/doubleking.js's DoubleKingInstance). A parameterless overload
        // here (and on every I*Instance subclass below) lets base() / : base()
        // compile for that pattern too (CS7036 otherwise), while the immediately-
        // following this.Algorithm = algorithm in the derived constructor still ends
        // up setting the same field either way.
        protected IAlgorithmInstance() { }
        public virtual void Feed(byte[] data) { }
        public virtual byte[] Result() { return Array.Empty<byte>(); }
        // Several stream-cipher instances (e.g. stream/shrinking-generator.js's
        // ShrinkingGeneratorInstance) override ClearData() to zero out sensitive
        // internal state and call 'super.ClearData()' first - JS is fine with that
        // even though the base Algorithm/AlgorithmInstance classes never actually
        // define the method (a missing property read is just undefined, never an
        // error), but C#'s 'base.ClearData()' needs a real member to bind to
        // (CS0117 otherwise). A no-op virtual here gives every subclass override
        // something real to call up to, matching Feed/Result's own pattern above.
        public virtual void ClearData() { }
    }

    // Algorithm-specific instance base classes
    public abstract class IBlockCipherInstance : IAlgorithmInstance
    {
        protected IBlockCipherInstance(Algorithm algo) : base(algo) { }
        protected IBlockCipherInstance() : base() { }
        public byte[] Key { get; set; }
        public byte[] IV { get; set; }
    }

    public abstract class IStreamCipherInstance : IAlgorithmInstance
    {
        protected IStreamCipherInstance(Algorithm algo) : base(algo) { }
        protected IStreamCipherInstance() : base() { }
        public byte[] Key { get; set; }
        public byte[] IV { get; set; }
        public byte[] Nonce { get; set; }
    }

    public abstract class IHashFunctionInstance : IAlgorithmInstance
    {
        protected IHashFunctionInstance(Algorithm algo) : base(algo) { }
        protected IHashFunctionInstance() : base() { }
        public int OutputSize { get; set; }
    }

    public abstract class IMacInstance : IAlgorithmInstance
    {
        protected IMacInstance(Algorithm algo) : base(algo) { }
        protected IMacInstance() : base() { }
        public byte[] Key { get; set; }
    }

    public abstract class IAeadInstance : IAlgorithmInstance
    {
        protected IAeadInstance(Algorithm algo) : base(algo) { }
        protected IAeadInstance() : base() { }
        public byte[] Key { get; set; }
        public byte[] Nonce { get; set; }
        public byte[] AssociatedData { get; set; }
    }

    public abstract class IKdfInstance : IAlgorithmInstance
    {
        protected IKdfInstance(Algorithm algo) : base(algo) { }
        protected IKdfInstance() : base() { }
        public byte[] Salt { get; set; }
        public int Iterations { get; set; }
        public int OutputLength { get; set; }
    }

    public abstract class ICompressionInstance : IAlgorithmInstance
    {
        protected ICompressionInstance(Algorithm algo) : base(algo) { }
        protected ICompressionInstance() : base() { }
    }

    public abstract class IRandomInstance : IAlgorithmInstance
    {
        protected IRandomInstance(Algorithm algo) : base(algo) { }
        protected IRandomInstance() : base() { }
        public byte[] Seed { get; set; }
    }

    public abstract class IChecksumInstance : IAlgorithmInstance
    {
        protected IChecksumInstance(Algorithm algo) : base(algo) { }
        protected IChecksumInstance() : base() { }
    }

    public abstract class IErrorCorrectionInstance : IAlgorithmInstance
    {
        protected IErrorCorrectionInstance(Algorithm algo) : base(algo) { }
        protected IErrorCorrectionInstance() : base() { }
        // Note: Algorithms use this._result field for intermediate storage
        // and override Result() method to return it
    }

    public abstract class IClassicalCipherInstance : IAlgorithmInstance
    {
        protected IClassicalCipherInstance(Algorithm algo) : base(algo) { }
        protected IClassicalCipherInstance() : base() { }
        public string Key { get; set; }
    }

    public abstract class IEncodingInstance : IAlgorithmInstance
    {
        protected IEncodingInstance(Algorithm algo) : base(algo) { }
        protected IEncodingInstance() : base() { }
    }

    public abstract class IRandomGeneratorInstance : IAlgorithmInstance
    {
        protected IRandomGeneratorInstance(Algorithm algo) : base(algo) { }
        protected IRandomGeneratorInstance() : base() { }
        public byte[] Seed { get; set; }
        public int OutputLength { get; set; }
    }

    public abstract class ICipherModeInstance : IAlgorithmInstance
    {
        protected ICipherModeInstance(Algorithm algo) : base(algo) { }
        protected ICipherModeInstance() : base() { }
        public byte[] Key { get; set; }
        public byte[] IV { get; set; }
        public dynamic UnderlyingCipher { get; set; }
    }

    public abstract class IAsymmetricCipherInstance : IAlgorithmInstance
    {
        protected IAsymmetricCipherInstance(Algorithm algo) : base(algo) { }
        protected IAsymmetricCipherInstance() : base() { }
        public byte[] PublicKey { get; set; }
        public byte[] PrivateKey { get; set; }
    }

    // Support types
    public class LinkItem
    {
        public string Title { get; }
        public string Url { get; }
        public LinkItem(string title, string url) { Title = title; Url = url; }
    }

    public class Vulnerability
    {
        public string Name { get; }
        public string Uri { get; }
        public string Description { get; }
        public string Mitigation { get; }
        public Vulnerability(string name, string description) : this(name, null, description, null) { }
        public Vulnerability(string name, string description, string mitigation) : this(name, null, description, mitigation) { }
        public Vulnerability(string name, string uri, string description, string mitigation) { Name = name; Uri = uri; Description = description; Mitigation = mitigation; }
    }

    public class TestCase
    {
        public byte[] Input { get; set; }
        public byte[] Expected { get; set; }
        public string Description { get; set; }
        public string Source { get; set; }
        // Duck-typed aliases used by object-literal style test vectors: { text, uri, input, ... }
        public string Text { get => Description; set => Description = value; }
        public string Uri { get => Source; set => Source = value; }

        // Algorithm-specific test parameters. These are typed as object because the same
        // duck-typed JS field name (e.g. "seed" or "salt") is assigned byte[] in some
        // algorithms and a plain number in others - object accepts either without a cast.
        public object Key { get; set; }
        public object Iv { get; set; }
        public object Nonce { get; set; }
        public object Aad { get; set; }
        public object AssociatedData { get; set; }
        public object Tag { get; set; }
        public object TagSize { get; set; }
        public object Seed { get; set; }
        public object Salt { get; set; }
        public object SaltKey { get; set; }
        public object SaltLength { get; set; }
        public object OutputSize { get; set; }
        public object OutputLength { get; set; }
        public object KeySize { get; set; }
        public object BlockSize { get; set; }
        public object Tweak { get; set; }
        public object Iterations { get; set; }
        public object PrivateKey { get; set; }
        public object PublicKey { get; set; }
        public object OtherPublicKey { get; set; }
        public object Rounds { get; set; }
        public object Cost { get; set; }
        public object HashFunction { get; set; }
        public object HashAlgorithm { get; set; }
        public object Cipher { get; set; }
        public object Label { get; set; }
        public object Info { get; set; }
        public object SharedInfo { get; set; }
        public object Otherinfo { get; set; }
        public object TestMode { get; set; }
        public object MgfFunction { get; set; }
        public object PaddingType { get; set; }
        public object OriginalLength { get; set; }
        public object SecurityLevel { get; set; }
        public object IsKEM { get; set; }
        public object K { get; set; }
        public object T { get; set; }
        public object Al { get; set; }
        public object WS { get; set; }
        public object Overhead { get; set; }
        public object Epsilon { get; set; }
        public object Q { get; set; }
        public object PreCodeRate { get; set; }
        public object TargetOverhead { get; set; }
        public object RepetitionCount { get; set; }
        public object Stages { get; set; }
        public object C { get; set; }
        public object Delta { get; set; }
        public object Systematic { get; set; }

        // Catch-all bag for any other algorithm-specific duck-typed test parameter not
        // declared above, so the transpiler can always emit a compiling object initializer
        // / member assignment regardless of which fields a particular JS algorithm attaches
        // to its test vectors.
        private readonly Dictionary<string, object> extra = new Dictionary<string, object>();
        public object this[string key]
        {
            get => extra.TryGetValue(key, out var v) ? v : null;
            set => extra[key] = value;
        }

        public TestCase() { }
        public TestCase(byte[] input, byte[] expected, string desc, string source)
        { Input = input; Expected = expected; Description = desc; Source = source; }
        public TestCase(byte[] input, int[] expected, string desc, string source)
        { Input = input; Expected = System.Array.ConvertAll(expected, b => (byte)b); Description = desc; Source = source; }
    }

    public class KeySize
    {
        public int MinSize { get; }
        public int MaxSize { get; }
        public int Step { get; }
        public int StepSize => Step; // Alias for compatibility
        public KeySize(int min, int max, int step) { MinSize = min; MaxSize = max; Step = step; }
    }

    // Mirrors OpCodes.js's own OpCodes._BitStream (constructed via
    // OpCodes.CreateBitStream(initialBytes)) - an MSB-first bit-packing writer/reader
    // used by compression algorithms (e.g. compression/golomb-bitstream.js) needing
    // precise sub-byte-granularity bit I/O. A direct, method-for-method port of the
    // real JS implementation (see OpCodes.js's own _BitStream for the source of truth).
    public class BitStream
    {
        private uint buffer = 0;
        private int bufferBits = 0;
        private readonly List<byte> byteArray = new List<byte>();
        private int readPosition = 0;
        private int totalBitsWritten = 0;

        public BitStream(byte[] initialBytes = null)
        {
            if (initialBytes != null && initialBytes.Length > 0)
            {
                byteArray.AddRange(initialBytes);
                totalBitsWritten = initialBytes.Length * 8;
            }
        }

        public void WriteBits(uint value, int numBits)
        {
            if (numBits <= 0 || numBits > 32) throw new Exception("BitStream.writeBits: numBits must be 1-32");
            uint mask = numBits == 32 ? 0xFFFFFFFFu : (1u << numBits) - 1;
            value &= mask;
            buffer = (buffer << numBits) | value;
            bufferBits += numBits;
            totalBitsWritten += numBits;
            while (bufferBits >= 8)
            {
                bufferBits -= 8;
                byteArray.Add(unchecked((byte)((buffer >> bufferBits) & 0xFF)));
                buffer = bufferBits > 0 ? (buffer & ((1u << bufferBits) - 1)) : 0;
            }
        }
        public void WriteBit(uint bit) => WriteBits(bit & 1, 1);
        public void WriteByte(uint value) => WriteBits(value & 0xFF, 8);
        public void WriteBytes(byte[] bytes) { foreach (var b in bytes) WriteByte(b); }
        public void WriteUint16BE(uint value) { WriteBits((value >> 8) & 0xFF, 8); WriteBits(value & 0xFF, 8); }
        public void WriteUint16LE(uint value) { WriteBits(value & 0xFF, 8); WriteBits((value >> 8) & 0xFF, 8); }
        public void WriteUint32BE(uint value) { WriteBits((value >> 24) & 0xFF, 8); WriteBits((value >> 16) & 0xFF, 8); WriteBits((value >> 8) & 0xFF, 8); WriteBits(value & 0xFF, 8); }
        public void WriteUint32LE(uint value) { WriteBits(value & 0xFF, 8); WriteBits((value >> 8) & 0xFF, 8); WriteBits((value >> 16) & 0xFF, 8); WriteBits((value >> 24) & 0xFF, 8); }
        public void WriteVarInt(uint value) { while (value >= 0x80) { WriteByte((value & 0x7F) | 0x80); value >>= 7; } WriteByte(value & 0x7F); }
        public void WriteUnary(int value) { for (int i = 0; i < value; ++i) WriteBit(1); WriteBit(0); }
        public void AlignToByte() { while (bufferBits % 8 != 0) WriteBit(0); }

        public uint ReadBits(int numBits)
        {
            if (numBits <= 0 || numBits > 32) throw new Exception("BitStream.readBits: numBits must be 1-32");
            uint result = 0;
            int bitsRead = 0;
            while (bitsRead < numBits)
            {
                int byteIndex = readPosition / 8;
                int bitOffset = readPosition % 8;
                if (byteIndex >= byteArray.Count)
                {
                    if (bitsRead == 0) throw new Exception("BitStream.readBits: No more data available");
                    break;
                }
                byte currentByte = byteArray[byteIndex];
                int availableBits = 8 - bitOffset;
                int bitsToRead = Math.Min(numBits - bitsRead, availableBits);
                uint mask = (1u << bitsToRead) - 1;
                uint extractedBits = ((uint)currentByte >> (availableBits - bitsToRead)) & mask;
                result = (result << bitsToRead) | extractedBits;
                bitsRead += bitsToRead;
                readPosition += bitsToRead;
            }
            return result;
        }
        public uint ReadBit() => ReadBits(1);
        public byte ReadByte() => unchecked((byte)ReadBits(8));
        public byte[] ReadBytes(int count) { var bytes = new byte[count]; for (int i = 0; i < count; ++i) bytes[i] = ReadByte(); return bytes; }
        public uint PeekBits(int numBits) { var saved = readPosition; var result = ReadBits(numBits); readPosition = saved; return result; }
        public void SkipBits(int numBits) { readPosition += numBits; var max = byteArray.Count * 8; if (readPosition > max) readPosition = max; }
        public bool HasMoreBits() => readPosition < byteArray.Count * 8;
        public int GetRemainingBits() => Math.Max(0, byteArray.Count * 8 - readPosition);
        public void ResetReadPosition() => readPosition = 0;
        public void SeekBits(uint bitOffset) { int max = byteArray.Count * 8; int offset = unchecked((int)(bitOffset & 0x7FFFFFFF)); readPosition = offset > max ? max : (offset > 0 ? offset : 0); }
        public uint ReadVarInt()
        {
            uint result = 0; int shift = 0; byte b;
            do
            {
                if (shift >= 32) throw new Exception("BitStream.readVarInt: Integer overflow");
                b = ReadByte();
                result |= (uint)(b & 0x7F) << shift;
                shift += 7;
            } while ((b & 0x80) != 0);
            return result;
        }
        public int ReadUnary() { int count = 0; while (HasMoreBits() && ReadBit() == 1) ++count; return count; }
        public bool IsAligned() => bufferBits % 8 == 0;

        public byte[] ToArray(bool padLastByte = true)
        {
            if (bufferBits > 0 && padLastByte)
            {
                int paddingBits = 8 - bufferBits;
                buffer <<= paddingBits;
                byteArray.Add(unchecked((byte)(buffer & 0xFF)));
                buffer = 0; bufferBits = 0;
            }
            return byteArray.ToArray();
        }
        public int GetBitLength() => totalBitsWritten;
        public int GetByteLength() => byteArray.Count + bufferBits / 8 + (bufferBits % 8 > 0 ? 1 : 0);
        public void Clear() { buffer = 0; bufferBits = 0; byteArray.Clear(); readPosition = 0; totalBitsWritten = 0; }
    }

    // OpCodes helper class
    public static class OpCodes
    {
        public static byte[] AnsiToBytes(string s) => System.Text.Encoding.ASCII.GetBytes(s);
        public static byte[] AsciiToBytes(string s) => System.Text.Encoding.ASCII.GetBytes(s);
        public static byte[] Hex8ToBytes(string hex) {
            var bytes = new byte[hex.Length / 2];
            for (int i = 0; i < bytes.Length; ++i)
                bytes[i] = System.Convert.ToByte(hex.Substring(i * 2, 2), 16);
            return bytes;
        }
        public static string BytesToHex8(byte[] bytes) {
            var sb = new System.Text.StringBuilder(bytes.Length * 2);
            foreach (var b in bytes) sb.Append(b.ToString("x2"));
            return sb.ToString();
        }
        public static uint ToUint32(dynamic v) => System.Convert.ToUInt32(v);
        public static ulong ToUint64(dynamic v) => System.Convert.ToUInt64(v);
        public static int ToInt32(dynamic v) => System.Convert.ToInt32(v);
        public static uint OrN(uint a, uint b) => a | b;
        public static uint AndN(uint a, uint b) => a & b;
        public static uint XorN(uint a, uint b) => a ^ b;
        public static uint NotN(uint a) => ~a;
        public static uint Shl32(uint v, int n) => v << n;
        public static uint Shr32(uint v, int n) => v >> n;
        public static ulong Shl64(ulong v, int n) => v << n;
        public static ulong Shr64(ulong v, int n) => v >> n;
        public static uint RotL32(uint v, int n) => (v << n) | (v >> (32 - n));
        public static uint RotR32(uint v, int n) => (v >> n) | (v << (32 - n));
        public static ushort RotL16(ushort v, int n) => (ushort)((v << n) | (v >> (16 - n)));
        public static ushort RotR16(ushort v, int n) => (ushort)((v >> n) | (v << (16 - n)));
        public static byte RotL8(byte v, int n) => (byte)((v << n) | (v >> (8 - n)));
        public static byte RotR8(byte v, int n) => (byte)((v >> n) | (v << (8 - n)));
        public static ulong RotL64(ulong v, int n) => (v << n) | (v >> (64 - n));
        public static ulong RotR64(ulong v, int n) => (v >> n) | (v << (64 - n));
        // Split-word (low32, high32, positions) 64-bit rotate overloads - mirrors
        // OpCodes.js's RotL64/RotR64(low, high, positions), used by ciphers that keep
        // 64-bit words as separate 32-bit halves (e.g. Threefish) rather than a native
        // ulong. Returns a (Low, High) tuple - PascalCase to match how CSharpTransformer
        // always emits tuple member access (see createTupleType/parseObjectTypeToTuple).
        public static (uint Low, uint High) RotL64(uint low, uint high, int positions) {
            positions &= 63;
            if (positions == 0) return (low, high);
            if (positions < 32) {
                uint newHigh = (high << positions) | (low >> (32 - positions));
                uint newLow = (low << positions) | (high >> (32 - positions));
                return (newLow, newHigh);
            }
            positions -= 32;
            if (positions == 0) return (high, low);
            {
                uint newHigh = (low << positions) | (high >> (32 - positions));
                uint newLow = (high << positions) | (low >> (32 - positions));
                return (newLow, newHigh);
            }
        }
        public static (uint Low, uint High) RotR64(uint low, uint high, int positions) {
            positions &= 63;
            if (positions == 0) return (low, high);
            if (positions < 32) {
                uint newLow = (low >> positions) | (high << (32 - positions));
                uint newHigh = (high >> positions) | (low << (32 - positions));
                return (newLow, newHigh);
            }
            positions -= 32;
            if (positions == 0) return (high, low);
            {
                uint newLow = (high >> positions) | (low << (32 - positions));
                uint newHigh = (low >> positions) | (high << (32 - positions));
                return (newLow, newHigh);
            }
        }
        // Count leading zeros (CLZ) - compatible with all .NET versions
        public static int Clz32(uint v) { if (v == 0) return 32; int n = 0; if ((v & 0xFFFF0000u) == 0) { n += 16; v <<= 16; } if ((v & 0xFF000000u) == 0) { n += 8; v <<= 8; } if ((v & 0xF0000000u) == 0) { n += 4; v <<= 4; } if ((v & 0xC0000000u) == 0) { n += 2; v <<= 2; } if ((v & 0x80000000u) == 0) { ++n; } return n; }
        public static int Clz64(ulong v) { if (v == 0) return 64; return v > 0xFFFFFFFFuL ? Clz32((uint)(v >> 32)) : 32 + Clz32((uint)v); }
        public static uint BitMask(int bits) => bits >= 32 ? 0xFFFFFFFFu : (1u << bits) - 1;
        public static ulong BitMask64(int bits) => bits >= 64 ? 0xFFFFFFFFFFFFFFFFuL : (1uL << bits) - 1;
        public static byte[] Unpack16BE(ushort v) => new byte[] { (byte)(v >> 8), (byte)v };
        public static byte[] Unpack16LE(ushort v) => new byte[] { (byte)v, (byte)(v >> 8) };
        public static byte[] Unpack32BE(uint v) => new byte[] { (byte)(v >> 24), (byte)(v >> 16), (byte)(v >> 8), (byte)v };
        public static byte[] Unpack32LE(uint v) => new byte[] { (byte)v, (byte)(v >> 8), (byte)(v >> 16), (byte)(v >> 24) };
        public static byte[] Unpack64BE(ulong v) => new byte[] { (byte)(v >> 56), (byte)(v >> 48), (byte)(v >> 40), (byte)(v >> 32), (byte)(v >> 24), (byte)(v >> 16), (byte)(v >> 8), (byte)v };
        public static byte[] Unpack64LE(ulong v) => new byte[] { (byte)v, (byte)(v >> 8), (byte)(v >> 16), (byte)(v >> 24), (byte)(v >> 32), (byte)(v >> 40), (byte)(v >> 48), (byte)(v >> 56) };
        public static ushort Pack16BE(byte b0, byte b1) => (ushort)(((ushort)b0 << 8) | b1);
        public static ushort Pack16LE(byte b0, byte b1) => (ushort)(b0 | ((ushort)b1 << 8));
        public static uint Pack32BE(byte b0, byte b1, byte b2, byte b3) => ((uint)b0 << 24) | ((uint)b1 << 16) | ((uint)b2 << 8) | b3;
        public static uint Pack32LE(byte b0, byte b1, byte b2, byte b3) => b0 | ((uint)b1 << 8) | ((uint)b2 << 16) | ((uint)b3 << 24);
        public static ulong Pack64BE(byte b0, byte b1, byte b2, byte b3, byte b4, byte b5, byte b6, byte b7) =>
            ((ulong)b0 << 56) | ((ulong)b1 << 48) | ((ulong)b2 << 40) | ((ulong)b3 << 32) | ((ulong)b4 << 24) | ((ulong)b5 << 16) | ((ulong)b6 << 8) | b7;
        public static ulong Pack64LE(byte b0, byte b1, byte b2, byte b3, byte b4, byte b5, byte b6, byte b7) =>
            b0 | ((ulong)b1 << 8) | ((ulong)b2 << 16) | ((ulong)b3 << 24) | ((ulong)b4 << 32) | ((ulong)b5 << 40) | ((ulong)b6 << 48) | ((ulong)b7 << 56);
        // Overloads accepting uint for compatibility with uint[] arrays (uses low 8 bits of each value)
        public static ushort Pack16BE(uint b0, uint b1) => Pack16BE((byte)b0, (byte)b1);
        public static ushort Pack16LE(uint b0, uint b1) => Pack16LE((byte)b0, (byte)b1);
        public static uint Pack32BE(uint b0, uint b1, uint b2, uint b3) => Pack32BE((byte)b0, (byte)b1, (byte)b2, (byte)b3);
        public static uint Pack32LE(uint b0, uint b1, uint b2, uint b3) => Pack32LE((byte)b0, (byte)b1, (byte)b2, (byte)b3);
        public static ulong Pack64BE(uint b0, uint b1, uint b2, uint b3, uint b4, uint b5, uint b6, uint b7) =>
            Pack64BE((byte)b0, (byte)b1, (byte)b2, (byte)b3, (byte)b4, (byte)b5, (byte)b6, (byte)b7);
        public static ulong Pack64LE(uint b0, uint b1, uint b2, uint b3, uint b4, uint b5, uint b6, uint b7) =>
            Pack64LE((byte)b0, (byte)b1, (byte)b2, (byte)b3, (byte)b4, (byte)b5, (byte)b6, (byte)b7);
        // NOTE: Int overloads removed to avoid ambiguity with byte overloads
        // When mixing byte (from array access) and int (from literals), use explicit casts
        // e.g., Pack32LE(data[0], data[1], (byte)0, (byte)0)
        public static byte[] XorArrays(byte[] a, byte[] b) {
            var result = new byte[a.Length];
            for (int i = 0; i < a.Length; ++i) result[i] = (byte)(a[i] ^ b[i]);
            return result;
        }
        public static void ClearArray(byte[] arr) => System.Array.Clear(arr, 0, arr.Length);
        public static bool IsInteger(double v) => v == Math.Floor(v);
        // OpCodes.js itself has no SecureRandom - iso10126.js's/random.js's/oaep.js's/
        // shamir-secret-sharing.js's padding schemes call OpCodes.SecureRandom(256)
        // (expecting a single random byte, 0-255) only on their non-deterministic path
        // (test mode / a fixed seed always take a different, deterministic branch
        // instead - the reason this was never caught by the JS suite, which never
        // exercises non-deterministic padding). Added here purely so that call site
        // COMPILES against a real random source (CS0117); System.Random.Shared is
        // thread-safe (.NET 6+), matching this stub's static, no-shared-state usage
        // pattern elsewhere. Returns byte (not uint) to match every real call site -
        // a bare scalar assignment/return into a byte[]-element or byte-typed method -
        // this stub has no JSDoc entry for the type inferencer (it isn't a real OpCodes.js
        // function) to pick up, so an unmatching uint return silently skipped its
        // narrowing cast at those sites (CS0266).
        public static byte SecureRandom(int max = 256) => (byte)System.Random.Shared.Next(max);
        public static byte[] ConcatArrays(byte[] a, byte[] b) {
            var result = new byte[a.Length + b.Length];
            System.Array.Copy(a, 0, result, 0, a.Length);
            System.Array.Copy(b, 0, result, a.Length, b.Length);
            return result;
        }
        // Matches OpCodes.js's REAL signature - ConcatArrays(arrays) takes a single
        // ARRAY OF ARRAYS (its own JSDoc param is uint8[][] arrays), not two flat
        // arrays (the overload above is a convenience shape for the common
        // two-array call site, not what the JS source itself calls when passed a
        // literal array of several byte[] results, e.g. a test-vector building
        // Expected via OpCodes.ConcatArrays([OpCodes.Unpack32LE(x), ...]) ).
        public static byte[] ConcatArrays(byte[][] arrays) {
            int totalLength = 0;
            for (int i = 0; i < arrays.Length; ++i) totalLength += arrays[i].Length;
            var result = new byte[totalLength];
            int offset = 0;
            for (int i = 0; i < arrays.Length; ++i) {
                System.Array.Copy(arrays[i], 0, result, offset, arrays[i].Length);
                offset += arrays[i].Length;
            }
            return result;
        }
        public static byte[] SliceArray(byte[] arr, int start, int end) {
            var result = new byte[end - start];
            System.Array.Copy(arr, start, result, 0, result.Length);
            return result;
        }
        // Generic fallback for non-byte element arrays (e.g. uint[] bit/word arrays -
        // common in permutation-heavy ciphers like DES). The non-generic byte[]
        // overload above is still preferred by C# overload resolution for byte[]
        // arguments, so this only ever applies where no byte[] overload matches.
        public static T[] SliceArray<T>(T[] arr, int start, int end) {
            var result = new T[end - start];
            System.Array.Copy(arr, start, result, 0, result.Length);
            return result;
        }
        public static uint ToDWord(long v) => (uint)(v & 0xFFFFFFFF);
        public static uint ToDWord(ulong v) => (uint)(v & 0xFFFFFFFF);
        public static uint ToDWord(int v) => (uint)v;
        public static uint ToDWord(uint v) => v;
        public static uint[] Hex32ToDWords(string hex) {
            var words = new uint[hex.Length / 8];
            for (int i = 0; i < words.Length; ++i)
                words[i] = System.Convert.ToUInt32(hex.Substring(i * 8, 8), 16);
            return words;
        }
        // Constant-time comparison to prevent timing attacks
        public static bool SecureCompare(byte[] a, byte[] b) {
            if (a == null || b == null || a.Length != b.Length) return false;
            int diff = 0;
            for (int i = 0; i < a.Length; ++i) diff |= a[i] ^ b[i];
            return diff == 0;
        }
        // Alias for SecureCompare
        public static bool ConstantTimeCompare(byte[] a, byte[] b) => SecureCompare(a, b);
        // Fill array with value
        public static void Fill(byte[] arr, byte value) { for (int i = 0; i < arr.Length; ++i) arr[i] = value; }
        public static void Fill(uint[] arr, uint value) { for (int i = 0; i < arr.Length; ++i) arr[i] = value; }
        public static void Fill(int[] arr, int value) { for (int i = 0; i < arr.Length; ++i) arr[i] = value; }
        // JS's array.sort([compareFn]) both mutates IN PLACE and yields the SAME array
        // reference as its value - unlike System.Array.Sort, which is void and cannot be
        // used as an expression (e.g. const sorted = arr.sort(cmp)). These sort in
        // place, exactly like Array.Sort, then hand the same reference back so callers
        // can use the call as a value wherever JS could.
        public static T[] SortArray<T>(T[] arr) { System.Array.Sort(arr); return arr; }
        public static T[] SortArray<T>(T[] arr, System.Comparison<T> comparer) { System.Array.Sort(arr, comparer); return arr; }
        // Array copy operations
        public static void ArrayCopy(byte[] src, int srcOffset, byte[] dst, int dstOffset, int length) => System.Array.Copy(src, srcOffset, dst, dstOffset, length);
        public static void ArrayCopy(uint[] src, int srcOffset, uint[] dst, int dstOffset, int length) => System.Array.Copy(src, srcOffset, dst, dstOffset, length);
        // Convert between byte[] and uint[]
        public static uint[] BytesToUint32Array(byte[] bytes) {
            var result = new uint[bytes.Length / 4];
            for (int i = 0; i < result.Length; ++i)
                result[i] = Pack32LE(bytes[i * 4], bytes[i * 4 + 1], bytes[i * 4 + 2], bytes[i * 4 + 3]);
            return result;
        }
        public static byte[] Uint32ArrayToBytes(uint[] arr) {
            var result = new byte[arr.Length * 4];
            for (int i = 0; i < arr.Length; ++i) {
                var bytes = Unpack32LE(arr[i]);
                result[i * 4] = bytes[0]; result[i * 4 + 1] = bytes[1];
                result[i * 4 + 2] = bytes[2]; result[i * 4 + 3] = bytes[3];
            }
            return result;
        }
        // Galois Field multiplication (GF(2^8) with polynomial 0x11b)
        public static byte GF256Mul(byte a, byte b) {
            byte result = 0;
            while (b != 0) {
                if ((b & 1) != 0) result ^= a;
                bool highBit = (a & 0x80) != 0;
                a <<= 1;
                if (highBit) a ^= 0x1b; // AES polynomial
                b >>= 1;
            }
            return result;
        }
        public static byte GF256Mul(byte a, byte b, byte poly) {
            byte result = 0;
            while (b != 0) {
                if ((b & 1) != 0) result ^= a;
                bool highBit = (a & 0x80) != 0;
                a <<= 1;
                if (highBit) a ^= poly;
                b >>= 1;
            }
            return result;
        }
        // Modular operations
        public static uint ModPow(uint b, uint e, uint m) {
            if (m == 1) return 0;
            uint result = 1;
            b %= m;
            while (e > 0) {
                if ((e & 1) == 1) result = (uint)((ulong)result * b % m);
                e >>= 1;
                b = (uint)((ulong)b * b % m);
            }
            return result;
        }
        public static ulong ModPow64(ulong b, ulong e, ulong m) {
            if (m == 1) return 0;
            ulong result = 1;
            b %= m;
            while (e > 0) {
                if ((e & 1) == 1) result = result * b % m;
                e >>= 1;
                b = b * b % m;
            }
            return result;
        }
        // Popcount (population count / Hamming weight)
        public static int PopCount(uint v) {
            v = v - ((v >> 1) & 0x55555555u);
            v = (v & 0x33333333u) + ((v >> 2) & 0x33333333u);
            return (int)((((v + (v >> 4)) & 0x0F0F0F0Fu) * 0x01010101u) >> 24);
        }
        public static int PopCount64(ulong v) => PopCount((uint)v) + PopCount((uint)(v >> 32));
        // Alias used by some algorithm files instead of PopCount
        public static int PopCountFast(uint v) => PopCount(v);
        public static int PopCountFast(int v) => PopCount((uint)v);
        public static int PopCountFast(ulong v) => PopCount64(v);
        // Byte extraction from multi-byte values
        public static byte GetByte(uint v, int index) => (byte)(v >> (index * 8));
        public static byte GetByte(ulong v, int index) => (byte)(v >> (index * 8));
        public static byte GetByte(int v, int index) => (byte)(v >> (index * 8));
        public static byte GetByte(long v, int index) => (byte)(v >> (index * 8));
        // SetByte - set byte at position
        public static uint SetByte(uint v, int index, byte b) => (v & ~(0xFFu << (index * 8))) | ((uint)b << (index * 8));
        public static ulong SetByte(ulong v, int index, byte b) => (v & ~(0xFFuL << (index * 8))) | ((ulong)b << (index * 8));
        // GetBit/SetBit - single-bit extraction/insertion (mirrors OpCodes.js
        // GetBit/SetBit). Overloaded across the numeric types algorithm code
        // actually calls these with (uint/int/byte source values, uint/int/
        // byte/bool bit values from array elements or literals) so callers
        // never need explicit casts - GetBit returns uint (assignable
        // directly to a uint[] element and explicitly castable to byte),
        // SetBit returns int (assignable directly to an int local and usable
        // as an array index, which uint is not without a cast).
        public static uint GetBit(uint value, int bitIndex) => (value >> bitIndex) & 1u;
        public static uint GetBit(int value, int bitIndex) => GetBit((uint)value, bitIndex);
        public static uint GetBit(byte value, int bitIndex) => GetBit((uint)value, bitIndex);
        public static uint GetBit(long value, int bitIndex) => (uint)((value >> bitIndex) & 1L);
        public static uint GetBit(ulong value, int bitIndex) => (uint)((value >> bitIndex) & 1uL);
        public static int SetBit(int value, int bitIndex, bool bitValue) => bitValue ? (value | (1 << bitIndex)) : (value & ~(1 << bitIndex));
        public static int SetBit(int value, int bitIndex, int bitValue) => SetBit(value, bitIndex, bitValue != 0);
        public static int SetBit(int value, int bitIndex, uint bitValue) => SetBit(value, bitIndex, bitValue != 0);
        public static int SetBit(int value, int bitIndex, byte bitValue) => SetBit(value, bitIndex, bitValue != 0);
        // ReverseBits
        public static byte ReverseBits(byte b) {
            b = (byte)(((b & 0xF0) >> 4) | ((b & 0x0F) << 4));
            b = (byte)(((b & 0xCC) >> 2) | ((b & 0x33) << 2));
            b = (byte)(((b & 0xAA) >> 1) | ((b & 0x55) << 1));
            return b;
        }
        public static uint ReverseBits(uint v) {
            v = ((v >> 1) & 0x55555555u) | ((v & 0x55555555u) << 1);
            v = ((v >> 2) & 0x33333333u) | ((v & 0x33333333u) << 2);
            v = ((v >> 4) & 0x0F0F0F0Fu) | ((v & 0x0F0F0F0Fu) << 4);
            v = ((v >> 8) & 0x00FF00FFu) | ((v & 0x00FF00FFu) << 8);
            return (v >> 16) | (v << 16);
        }
        public static ulong ReverseBits(ulong v) {
            return ((ulong)ReverseBits((uint)(v >> 32))) | ((ulong)ReverseBits((uint)v) << 32);
        }
        // ReverseBytes
        public static ushort ReverseBytes(ushort v) => (ushort)((v >> 8) | (v << 8));
        public static uint ReverseBytes(uint v) {
            return ((v >> 24) & 0xFF) | ((v >> 8) & 0xFF00) | ((v << 8) & 0xFF0000) | (v << 24);
        }
        public static ulong ReverseBytes(ulong v) {
            return ((ulong)ReverseBytes((uint)(v >> 32))) | ((ulong)ReverseBytes((uint)v) << 32);
        }
        // Fixed-width 32-bit bitwise/arithmetic ops (mirrors OpCodes.js's Xor32/And32/
        // Or32/Not32/Add32/Sub32/Mul32) - added because dozens of algorithm files call
        // these directly rather than through AndN/OrN/XorN/NotN (BigInt-oriented) or the
        // RotL32-style helpers already stubbed above. Both int and uint overloads are
        // provided since call sites mix array-element uint operands with int literal/
        // local operands depending on the source file's own typing.
        public static uint Xor32(uint a, uint b) => a ^ b;
        public static uint Xor32(int a, int b) => (uint)(a ^ b);
        public static uint And32(uint a, uint b) => a & b;
        public static uint And32(int a, int b) => (uint)(a & b);
        public static uint Or32(uint a, uint b) => a | b;
        public static uint Or32(int a, int b) => (uint)(a | b);
        public static uint Not32(uint a) => ~a;
        public static uint Not32(int a) => (uint)(~a);
        public static uint Add32(uint a, uint b) => unchecked(a + b);
        public static uint Add32(int a, int b) => unchecked((uint)(a + b));
        public static uint Sub32(uint a, uint b) => unchecked(a - b);
        public static uint Sub32(int a, int b) => unchecked((uint)(a - b));
        public static uint Mul32(uint a, uint b) => unchecked(a * b);
        public static uint Mul32(int a, int b) => unchecked((uint)(a * b));
        // Fixed-width 8/16-bit shift and bitwise ops (mirrors OpCodes.js's Shl8/Shr8/
        // And8/Or8/Xor8/Shl16/Shr16). byte/ushort overloads match the JSDoc-declared
        // uint8/uint16 signatures; uint overloads cover the common case of a uint[]-typed
        // array element (e.g. a permutation table entry) being shifted/masked directly.
        public static byte Shl8(byte value, int positions) => (byte)((value << positions) & 0xFF);
        public static byte Shl8(uint value, int positions) => Shl8((byte)value, positions);
        public static byte Shr8(byte value, int positions) => (byte)((value >> positions) & 0xFF);
        public static byte Shr8(uint value, int positions) => Shr8((byte)value, positions);
        public static byte And8(byte a, byte b) => (byte)(a & b);
        public static byte And8(uint a, uint b) => And8((byte)a, (byte)b);
        public static byte Or8(byte a, byte b) => (byte)(a | b);
        public static byte Or8(uint a, uint b) => Or8((byte)a, (byte)b);
        public static byte Xor8(byte a, byte b) => (byte)(a ^ b);
        public static byte Xor8(uint a, uint b) => Xor8((byte)a, (byte)b);
        public static ushort Shl16(ushort value, int positions) => (ushort)((value << positions) & 0xFFFF);
        public static ushort Shl16(uint value, int positions) => Shl16((ushort)value, positions);
        public static ushort Shr16(ushort value, int positions) => (ushort)((value >> positions) & 0xFFFF);
        public static ushort Shr16(uint value, int positions) => Shr16((ushort)value, positions);
        public static ushort And16(ushort a, ushort b) => (ushort)(a & b);
        public static ushort Or16(ushort a, ushort b) => (ushort)(a | b);
        public static ushort Xor16(ushort a, ushort b) => (ushort)(a ^ b);
        // Truncating scalar converters (mirrors OpCodes.js's ToByte/ToInt/ToUint16/ToWord)
        public static byte ToByte(int value) => (byte)(value & 0xFF);
        public static byte ToByte(uint value) => (byte)(value & 0xFF);
        public static byte ToByte(long value) => (byte)(value & 0xFF);
        public static byte ToByte(ulong value) => (byte)(value & 0xFF);
        public static byte ToByte(double value) => (byte)((long)value & 0xFF);
        public static int ToInt(dynamic value) => (int)value;
        public static ushort ToUint16(dynamic value) => (ushort)(long)value;
        public static ushort ToWord(dynamic value) => (ushort)(long)value;
        public static ulong UInt64(dynamic value) => System.Convert.ToUInt64(value);
        // Generic array copy (mirrors OpCodes.js's CopyArray) - works for any element
        // type (byte[], uint[], ...), unlike the byte[]-specific helpers above.
        public static T[] CopyArray<T>(T[] arr) => arr == null ? null : (T[])arr.Clone();
        public static bool ArraysEqual<T>(T[] a, T[] b) {
            if (a == null || b == null) return a == b;
            if (a.Length != b.Length) return false;
            for (int i = 0; i < a.Length; ++i) if (!System.Collections.Generic.EqualityComparer<T>.Default.Equals(a[i], b[i])) return false;
            return true;
        }
        // Alias used by some algorithm files instead of ArraysEqual
        public static bool CompareArrays<T>(T[] a, T[] b) => ArraysEqual(a, b);
        public static byte[] XorArrayWithByte(byte[] array, byte value) {
            var result = new byte[array.Length];
            for (int i = 0; i < array.Length; ++i) result[i] = (byte)(array[i] ^ value);
            return result;
        }
        // Arbitrary-precision (BigInt-equivalent) shift/rotate ops - mirrors OpCodes.js's
        // ShiftLn/ShiftRn/RotL64n/RotR64n, used by algorithms working with values wider
        // than 64 bits (e.g. GHASH-style 128-bit lanes) via System.Numerics.BigInteger.
        public static System.Numerics.BigInteger ShiftLn(System.Numerics.BigInteger value, int positions) => value << positions;
        public static System.Numerics.BigInteger ShiftRn(System.Numerics.BigInteger value, int positions) => value >> positions;
        public static System.Numerics.BigInteger RotL64n(System.Numerics.BigInteger value, int positions) {
            var mask64 = (System.Numerics.BigInteger.One << 64) - 1;
            value &= mask64;
            positions &= 63;
            if (positions == 0) return value;
            return ((value << positions) | (value >> (64 - positions))) & mask64;
        }
        public static System.Numerics.BigInteger RotR64n(System.Numerics.BigInteger value, int positions) {
            var mask64 = (System.Numerics.BigInteger.One << 64) - 1;
            value &= mask64;
            positions &= 63;
            if (positions == 0) return value;
            return ((value >> positions) | (value << (64 - positions))) & mask64;
        }
        public static System.Numerics.BigInteger RotL128n(System.Numerics.BigInteger value, int positions) {
            var mask128 = (System.Numerics.BigInteger.One << 128) - 1;
            value &= mask128;
            positions &= 127;
            if (positions == 0) return value;
            return ((value << positions) | (value >> (128 - positions))) & mask128;
        }
        public static System.Numerics.BigInteger RotR128n(System.Numerics.BigInteger value, int positions) {
            var mask128 = (System.Numerics.BigInteger.One << 128) - 1;
            value &= mask128;
            positions &= 127;
            if (positions == 0) return value;
            return ((value >> positions) | (value << (128 - positions))) & mask128;
        }
        // Arithmetic (sign-preserving) right shift for 32-bit signed values - mirrors
        // OpCodes.js's Shr32Signed, distinct from the logical Shr32 above.
        public static int Shr32Signed(int value, int positions) => value >> positions;
        // Byte-string conversion (mirrors OpCodes.js's BytesToAnsi - Latin1/ISO-8859-1)
        public static string BytesToAnsi(byte[] bytes) => System.Text.Encoding.Latin1.GetString(bytes);
        // High 32 bits of a 32x32 -> 64-bit unsigned multiplication (mirrors OpCodes.js's
        // MulHi32, used by counter-based PRNGs like Philox) - a plain ulong widening
        // multiply is exact and far simpler than OpCodes.js's 16-bit-split algorithm
        // (needed there only because JS numbers lose precision past 2^53).
        public static uint MulHi32(uint a, uint b) => (uint)(((ulong)a * b) >> 32);
        // Arbitrary-precision bit extraction/insertion (mirrors OpCodes.js's GetBitN/
        // SetBitN) and modular arithmetic (MulModN/SquareModN/ModPowN/GcdN/BitCountN),
        // used by BigInteger-modulus RNGs like Blum-Blum-Shub/Blum-Micali - straight
        // ports of the BigInt originals.
        public static System.Numerics.BigInteger GetBitN(System.Numerics.BigInteger value, int bitIndex) => (value >> bitIndex) & 1;
        public static System.Numerics.BigInteger SetBitN(System.Numerics.BigInteger value, int bitIndex, System.Numerics.BigInteger bitValue) {
            var mask = System.Numerics.BigInteger.One << bitIndex;
            return ((bitValue & 1) != 0) ? (value | mask) : (value & ~mask);
        }
        public static System.Numerics.BigInteger MulModN(System.Numerics.BigInteger a, System.Numerics.BigInteger b, System.Numerics.BigInteger m) => ((a % m) * (b % m)) % m;
        public static System.Numerics.BigInteger SquareModN(System.Numerics.BigInteger a, System.Numerics.BigInteger m) {
            var reduced = a % m;
            return (reduced * reduced) % m;
        }
        public static System.Numerics.BigInteger ModPowN(System.Numerics.BigInteger baseValue, System.Numerics.BigInteger exp, System.Numerics.BigInteger m) {
            if (m == 1) return 0;
            if (exp == 0) return 1;
            System.Numerics.BigInteger result = 1;
            baseValue %= m;
            while (exp > 0) {
                if ((exp & 1) == 1) result = (result * baseValue) % m;
                exp >>= 1;
                baseValue = (baseValue * baseValue) % m;
            }
            return result;
        }
        public static System.Numerics.BigInteger GcdN(System.Numerics.BigInteger a, System.Numerics.BigInteger b) {
            a = a < 0 ? -a : a;
            b = b < 0 ? -b : b;
            while (b != 0) {
                var temp = b;
                b = a % b;
                a = temp;
            }
            return a;
        }
        public static int BitCountN(System.Numerics.BigInteger value) {
            if (value == 0) return 1;
            value = value < 0 ? -value : value;
            int count = 0;
            while (value > 0) {
                ++count;
                value >>= 1;
            }
            return count;
        }
        // ========================[ CS0117 STUB GAP-FILL ]========================
        // The methods below mirror real OpCodes.js helpers (or, where noted, a
        // documented-but-never-implemented placeholder) that several algorithm files
        // call but that the embedded stub above never defined - every such call site
        // was a hard CS0117 ("no definition for ...") with no way to even reach the
        // rest of the file's errors. Added as a batch once several algorithms (hotp/
        // totp/sp800-108-*/aes-ccm/blake/gcm/3way/dsfmt/...) all hit the same class of
        // gap; each one below is a direct C# port of OpCodes.js's own JS body (same
        // file, function of the same name) unless the comment says otherwise.

        // HMAC has NO counterpart in OpCodes.js at all - hotp.js/totp.js/sp800-108-*.js
        // only ever probe 'OpCodes && OpCodes.HMAC' as a last-resort fallback AFTER a
        // Node 'require('crypto')' attempt (which always succeeds in real JS, so this
        // branch is dead code there); the transpiler drops the 'require'-based branch
        // entirely (no Node crypto equivalent) and re-emits the OpCodes fallback as the
        // only remaining path, so it must be a real, working implementation here rather
        // than the "never actually reachable" JS original. Declared 'dynamic' (not
        // byte[]) because callers disagree on the array's declared element type -
        // hotp.js's '_hmacSHA1' returns 'uint[]' (its 20-byte result is bit-masked
        // against uint literals), totp.js's '_hmac' returns 'byte[]' - a fixed byte[]
        // return type would hard-fail one of the two with CS0029; 'dynamic' lets the
        // compiler defer to each call site's own declared return type instead.
        public static dynamic HMAC(byte[] key, byte[] message, string hashName) {
            var normalized = (hashName ?? "SHA-1").Replace("-", "").ToUpperInvariant();
            using (var hmac = CreateHmacAlgorithm(normalized, key))
                return hmac.ComputeHash(message);
        }
        private static System.Security.Cryptography.HMAC CreateHmacAlgorithm(string normalizedName, byte[] key) {
            switch (normalizedName) {
                case "MD5": return new System.Security.Cryptography.HMACMD5(key);
                case "SHA1": return new System.Security.Cryptography.HMACSHA1(key);
                case "SHA384": return new System.Security.Cryptography.HMACSHA384(key);
                case "SHA512": return new System.Security.Cryptography.HMACSHA512(key);
                case "SHA256":
                default: return new System.Security.Cryptography.HMACSHA256(key);
            }
        }
        // ArraySlice is CreateArray/SliceArray's own OpCodes.js name for the same
        // "safe slice" operation SliceArray already implements above (generic T[]
        // overload) - just an alias under the real OpCodes.js name.
        public static T[] ArraySlice<T>(T[] arr, int start, int end) => SliceArray(arr, start, end);
        // CreateArray - mirrors OpCodes.js's CreateArray(length, value): a fixed-size
        // array pre-filled with 'value' (defaults to 0).
        public static byte[] CreateArray(uint length, byte value = 0) {
            var arr = new byte[length];
            if (value != 0) for (int i = 0; i < arr.Length; ++i) arr[i] = value;
            return arr;
        }
        // Split64 - mirrors OpCodes.js's Split64(value): splits a 64-bit unsigned value
        // into its high/low 32-bit halves. PascalCase tuple names (High32/Low32) match
        // how CSharpTransformer always emits tuple member access for JSDoc-declared
        // '{high32, low32}' tuple returns (see createTupleType).
        public static (uint High32, uint Low32) Split64(ulong value) =>
            (unchecked((uint)(value >> 32)), unchecked((uint)value));
        // AddMod/SubMod - mirror OpCodes.js's own (a % m ± b % m) % m bodies exactly,
        // including the JS 'SubMod''s "+ m" guard against a negative intermediate.
        public static int AddMod(int a, int b, int m) => ((a % m) + (b % m)) % m;
        public static int SubMod(int a, int b, int m) => ((a % m) - (b % m) + m) % m;
        // XOR32 has no OpCodes.js counterpart (only gcm.js calls it) - a plain 32-bit
        // XOR, same semantics as the existing XorN above under the name gcm.js expects.
        public static uint XOR32(uint a, uint b) => a ^ b;
        // BytesToWords32BE/Words32ToBytesBE - mirror OpCodes.js's own byte<->word
        // big-endian packing loops (built from Pack32BE/Unpack32BE, already above).
        public static uint[] BytesToWords32BE(byte[] bytes) {
            int wordCount = (bytes.Length + 3) / 4;
            var words = new uint[wordCount];
            for (int i = 0; i < wordCount; ++i) {
                int b = i * 4;
                byte b0 = b < bytes.Length ? bytes[b] : (byte)0;
                byte b1 = b + 1 < bytes.Length ? bytes[b + 1] : (byte)0;
                byte b2 = b + 2 < bytes.Length ? bytes[b + 2] : (byte)0;
                byte b3 = b + 3 < bytes.Length ? bytes[b + 3] : (byte)0;
                words[i] = Pack32BE(b0, b1, b2, b3);
            }
            return words;
        }
        public static byte[] Words32ToBytesBE(uint[] words) {
            var bytes = new byte[words.Length * 4];
            for (int i = 0; i < words.Length; ++i) {
                var b = Unpack32BE(words[i]);
                bytes[i * 4] = b[0]; bytes[i * 4 + 1] = b[1]; bytes[i * 4 + 2] = b[2]; bytes[i * 4 + 3] = b[3];
            }
            return bytes;
        }
        // ========================[ 64-BIT [HIGH,LOW]-PAIR HELPERS (BLAKE) ]========================
        // Direct ports of OpCodes.js's own Add3L64/Add3H64/Add64_HL/RotR64_HL/Swap64_HL/
        // Xor64_HL - used by blake.js's 64-bit G-function mixing, which keeps 64-bit
        // words as separate 32-bit HIGH/LOW halves (no native 64-bit ops) exactly like
        // OpCodes.js does for the same reason (JS's 53-bit safe-integer limit).
        // Add3L64 returns 'long' (not 'int'/'uint') - CSHARP_OPCODES_SIGNATURE_OVERRIDES
        // in CSharpTransformer.js forces the SAME 'long' type onto both the local
        // variable holding this result AND Add3H64's first parameter; three unsigned
        // 32-bit values can sum past 2^32 (up to ~3*2^32), so the carry into the high
        // word only survives if the intermediate sum is never truncated back to 32
        // bits anywhere along that path.
        public static long Add3L64(int al, int bl, int cl) => (long)(uint)al + (uint)bl + (uint)cl;
        public static uint Add3H64(long lowSum, int ah, int bh, int ch) =>
            unchecked((uint)((uint)ah + (uint)bh + (uint)ch + (uint)(lowSum >> 32)));
        public static (uint H, uint L) Add64_HL(int ah, int al, int bh, int bl) {
            long l = (uint)al + (uint)bl;
            uint h = unchecked((uint)((uint)ah + (uint)bh + (uint)(l >> 32)));
            return (h, unchecked((uint)l));
        }
        public static (uint H, uint L) RotR64_HL(int high, int low, int n) {
            uint h = unchecked((uint)high), l = unchecked((uint)low);
            n &= 63;
            if (n == 0) return (h, l);
            if (n == 32) return (l, h);
            if (n < 32) return ((h >> n) | (l << (32 - n)), (l >> n) | (h << (32 - n)));
            n -= 32;
            return ((l >> n) | (h << (32 - n)), (h >> n) | (l << (32 - n)));
        }
        public static (uint H, uint L) Swap64_HL(int high, int low) => (unchecked((uint)low), unchecked((uint)high));
        public static (uint H, uint L) Xor64_HL(int ah, int al, int bh, int bl) =>
            (unchecked((uint)(ah ^ bh)), unchecked((uint)(al ^ bl)));
        // EncodeMsgLength64LE - mirrors OpCodes.js's own Split64 + Unpack32LE-based body.
        public static byte[] EncodeMsgLength64LE(ulong bitLength) {
            var split = Split64(bitLength);
            var low = Unpack32LE(split.Low32);
            var high = Unpack32LE(split.High32);
            var result = new byte[8];
            System.Array.Copy(low, 0, result, 0, 4);
            System.Array.Copy(high, 0, result, 4, 4);
            return result;
        }
        // GCMIncrement/GHashMul - direct ports of OpCodes.js's own 16-byte GCM counter
        // increment and GHASH carry-less (GF(2^128)) multiplication bodies.
        public static byte[] GCMIncrement(byte[] counter) {
            if (counter == null || counter.Length != 16) throw new System.Exception("GCMIncrement requires 16-byte counter");
            int carry = 1;
            for (int i = 15; i >= 12; --i) {
                int sum = counter[i] + carry;
                counter[i] = unchecked((byte)(sum & 0xFF));
                carry = sum >> 8;
            }
            return counter;
        }
        public static byte[] GHashMul(byte[] x, byte[] y) {
            if (x == null || x.Length != 16 || y == null || y.Length != 16)
                throw new System.Exception("GHashMul requires 16-byte arrays");
            var z = new byte[16];
            var v = (byte[])y.Clone();
            for (int i = 0; i < 16; ++i) {
                byte xi = x[i];
                for (int j = 7; j >= 0; --j) {
                    if ((xi & (1 << j)) != 0)
                        for (int k = 0; k < 16; ++k) z[k] = unchecked((byte)(z[k] ^ v[k]));
                    byte lsb = unchecked((byte)(v[15] & 1));
                    for (int k = 15; k >= 1; --k) v[k] = unchecked((byte)((v[k] >> 1) | ((v[k - 1] & 1) << 7)));
                    v[0] = unchecked((byte)(v[0] >> 1));
                    if (lsb != 0) v[0] = unchecked((byte)(v[0] ^ 0xE1));
                }
            }
            return z;
        }
        // DoubleToBytes - OpCodes.js's own body is a documented no-op placeholder
        // ("this placeholder returns zero bytes... In C#: return
        // BitConverter.GetBytes(value)" - its own comment names this exact
        // implementation as the intended real one), so port the intended behavior
        // rather than the JS placeholder's always-zero bytes. IEEE-754 little-endian,
        // matching BytesToDouble's own little-endian expectation.
        public static byte[] DoubleToBytes(double value) {
            var bytes = System.BitConverter.GetBytes(value);
            if (!System.BitConverter.IsLittleEndian) System.Array.Reverse(bytes);
            return bytes;
        }
        // CreateBitStream - mirrors OpCodes.js's factory of the same name; see the
        // BitStream class above (declared alongside TestCase/KeySize) for the real
        // port of OpCodes.js's _BitStream implementation.
        public static BitStream CreateBitStream(byte[] initialBytes = null) => new BitStream(initialBytes);
        // MASK32 - special/3way.js is the only caller ('OpCodes.AndN(OpCodes.Shl32(1,
        // round - 1), OpCodes.MASK32)'); real OpCodes.js has NO such constant, so in JS
        // this reads 'undefined', which '&' (AndN's plain 'a & b' body) coerces to 0 per
        // ToInt32(undefined) === 0, forcing that AND to always be 0 - the same "missing
        // OpCodes constant silently becomes 0" quirk already documented in
        // PythonTransformer.js's '_OpCodesMeta.__getattr__'. Declaring the constant as 0
        // (not the "obvious" 0xFFFFFFFF a mask name suggests) reproduces that exact
        // quirk instead of changing 3way.js's round-key schedule behavior.
        public const uint MASK32 = 0u;
    }

    // Global helper functions (without OpCodes prefix)
    public static class Helpers
    {
        public static byte[] XorArrays(byte[] a, byte[] b) => OpCodes.XorArrays(a, b);
        public static byte[] ConcatArrays(byte[] a, byte[] b) => OpCodes.ConcatArrays(a, b);
        public static byte[] SliceArray(byte[] arr, int start, int end) => OpCodes.SliceArray(arr, start, end);
        public static T[] SliceArray<T>(T[] arr, int start, int end) => OpCodes.SliceArray(arr, start, end);
        public static uint RotL32(uint v, int n) => OpCodes.RotL32(v, n);
        public static uint RotR32(uint v, int n) => OpCodes.RotR32(v, n);
        public static ulong RotL64(ulong v, int n) => OpCodes.RotL64(v, n);
        public static ulong RotR64(ulong v, int n) => OpCodes.RotR64(v, n);
    }

    // Fountain-code foundation library (mirrors algorithms/ecc/fountain-foundation.data.js) -
    // GF(2^m) arithmetic, sparse matrices, bipartite graphs, degree distributions, a seeded
    // LCG RNG and a tiny profiler, shared by the LT/Raptor/RaptorQ/BATS/Tornado/Online-code
    // family. Those files require() this as a sibling .data.js module and destructure it
    // off their UMD factory's extra parameter (e.g. const { SeededRandom, ... } =
    // FountainFoundation;) - a single-file transpile can't see across that require(), so
    // CSharpTransformer's transformVariableDeclaration skips the resulting phantom
    // _destructure_N/per-name fields (see unresolvedDestructureTemps) and every usage
    // instead resolves directly to these always-available stub classes, exactly like OpCodes.
    public class GaloisField
    {
        public int P { get; set; }
        public int M { get; set; }
        public int Size { get; set; }
        public int Primitive { get; set; }
        public int[] ExpTable { get; set; }
        public int[] LogTable { get; set; }

        // Dimension/count parameters across this whole foundation-library stub file are
        // widened to long (rather than int) purely so that whichever numeric type
        // CSharpTransformer happened to infer for the caller's local (int/uint/long all
        // implicitly widen to long, but not vice versa) always type-checks at the call site
        // without needing per-call-site cast insertion (CS1503) - internal array allocation
        // still narrows back to int since C# array lengths can't be wider than that anyway.
        public GaloisField(long p = 2, long m = 8)
        {
            P = (int)p; M = (int)m;
            Size = (int)Math.Pow(p, m);
            Primitive = FindPrimitive();
            BuildTables();
        }

        private int FindPrimitive()
        {
            if (P == 2 && M == 8) return 0x11D;
            throw new Exception($"Primitive polynomial not defined for GF({P}^{M})");
        }

        private void BuildTables()
        {
            ExpTable = new int[Size];
            LogTable = new int[Size];
            int x = 1;
            for (int i = 0; i < Size - 1; i++)
            {
                ExpTable[i] = x;
                LogTable[x] = i;
                x = PrimitiveMultiply(x, 2);
            }
        }

        private int PrimitiveMultiply(int a, int b)
        {
            int result = 0;
            while (b > 0)
            {
                if ((b & 1) != 0) result ^= a;
                a <<= 1;
                if ((a & Size) != 0) a ^= Primitive;
                b >>= 1;
            }
            return result;
        }

        public int Add(int a, int b) => a ^ b;
        public int Subtract(int a, int b) => Add(a, b);
        public int Multiply(int a, int b)
        {
            if (a == 0 || b == 0) return 0;
            return ExpTable[(LogTable[a] + LogTable[b]) % (Size - 1)];
        }
        public int Divide(int a, int b)
        {
            if (b == 0) throw new Exception("Division by zero in Galois Field");
            if (a == 0) return 0;
            return ExpTable[(LogTable[a] - LogTable[b] + Size - 1) % (Size - 1)];
        }
        public int Power(int a, int exp)
        {
            if (exp == 0) return 1;
            if (a == 0) return 0;
            return ExpTable[(LogTable[a] * exp) % (Size - 1)];
        }
        public int Inverse(int a)
        {
            if (a == 0) throw new Exception("Cannot invert zero in Galois Field");
            return ExpTable[Size - 1 - LogTable[a]];
        }
    }

    public class SparseMatrix
    {
        public int Rows { get; set; }
        public int Cols { get; set; }
        private readonly Dictionary<string, int> data = new Dictionary<string, int>();
        private readonly HashSet<int>[] rowNonZeros;
        private readonly HashSet<int>[] colNonZeros;

        public SparseMatrix(long rows, long cols)
        {
            Rows = (int)rows; Cols = (int)cols;
            rowNonZeros = new HashSet<int>[Rows];
            for (int i = 0; i < Rows; i++) rowNonZeros[i] = new HashSet<int>();
            colNonZeros = new HashSet<int>[Cols];
            for (int i = 0; i < Cols; i++) colNonZeros[i] = new HashSet<int>();
        }

        public int Get(long row, long col)
        {
            var key = row + "," + col;
            return data.TryGetValue(key, out var v) ? v : 0;
        }

        public void Set(long row, long col, long value)
        {
            var key = row + "," + col;
            int r = (int)row, c = (int)col;
            if (value == 0)
            {
                data.Remove(key);
                rowNonZeros[r].Remove(c);
                colNonZeros[c].Remove(r);
            }
            else
            {
                data[key] = (int)value;
                rowNonZeros[r].Add(c);
                colNonZeros[c].Add(r);
            }
        }

        public int GetRowDegree(long row) => rowNonZeros[(int)row].Count;
        public int GetColDegree(long col) => colNonZeros[(int)col].Count;
        public int[] GetRowNonZeros(long row) => rowNonZeros[(int)row].ToArray();
        public int[] GetColNonZeros(long col) => colNonZeros[(int)col].ToArray();

        public void XorRow(long targetRow, long sourceRow)
        {
            foreach (var col in GetRowNonZeros(sourceRow))
            {
                var currentValue = Get(targetRow, col);
                var sourceValue = Get(sourceRow, col);
                Set(targetRow, col, currentValue ^ sourceValue);
            }
        }

        public SparseMatrix Clone()
        {
            var result = new SparseMatrix(Rows, Cols);
            foreach (var kv in data)
            {
                var parts = kv.Key.Split(',');
                result.Set(int.Parse(parts[0]), int.Parse(parts[1]), kv.Value);
            }
            return result;
        }
    }

    public class BipartiteGraph
    {
        public int LeftNodes { get; set; }
        public int RightNodes { get; set; }
        public Dictionary<int, HashSet<int>> Edges { get; set; } = new Dictionary<int, HashSet<int>>();
        public Dictionary<int, HashSet<int>> ReverseEdges { get; set; } = new Dictionary<int, HashSet<int>>();

        public BipartiteGraph(long leftNodes, long rightNodes)
        {
            LeftNodes = (int)leftNodes; RightNodes = (int)rightNodes;
            for (int i = 0; i < RightNodes; i++) Edges[i] = new HashSet<int>();
            for (int i = 0; i < LeftNodes; i++) ReverseEdges[i] = new HashSet<int>();
        }

        public void AddEdge(long leftNode, long rightNode)
        {
            if (leftNode >= LeftNodes || rightNode >= RightNodes)
                throw new Exception("Node index out of bounds");
            int l = (int)leftNode, r = (int)rightNode;
            Edges[r].Add(l);
            ReverseEdges[l].Add(r);
        }

        public void RemoveEdge(long leftNode, long rightNode)
        {
            Edges[(int)rightNode].Remove((int)leftNode);
            ReverseEdges[(int)leftNode].Remove((int)rightNode);
        }

        public int[] GetNeighbors(long rightNode) => Edges[(int)rightNode].ToArray();
        public int[] GetReverseNeighbors(long leftNode) => ReverseEdges[(int)leftNode].ToArray();
        public int GetDegree(long rightNode) => Edges[(int)rightNode].Count;
        public int GetReverseDegree(long leftNode) => ReverseEdges[(int)leftNode].Count;

        public int[] FindDegreeOneNodes()
        {
            var degreeOne = new List<int>();
            for (int i = 0; i < RightNodes; i++)
                if (GetDegree(i) == 1) degreeOne.Add(i);
            return degreeOne.ToArray();
        }

        public BipartiteGraph Clone()
        {
            var result = new BipartiteGraph(LeftNodes, RightNodes);
            for (int rightNode = 0; rightNode < RightNodes; rightNode++)
                foreach (var leftNode in GetNeighbors(rightNode))
                    result.AddEdge(leftNode, rightNode);
            return result;
        }
    }

    public class DegreeDistribution
    {
        public int K { get; set; }
        public DegreeDistribution(long k) { K = (int)k; }

        public double IdealSoliton(long degree)
        {
            if (degree == 1) return 1.0 / K;
            if (degree >= 2 && degree <= K) return 1.0 / (degree * (degree - 1.0));
            return 0;
        }

        public double RobustSoliton(long degree, double c = 0.1, double delta = 0.5)
        {
            var idealProb = IdealSoliton(degree);
            var r = c * Math.Log(K / delta) * Math.Sqrt(K);
            double tau = 0;
            for (int i = 1; i <= K; i++)
            {
                if (i <= K / r) tau += r / (i * K);
                else if (i == Math.Floor(K / r) + 1) tau += r * Math.Log(r / delta) / K;
            }
            double tauDegree = 0;
            if (degree <= K / r) tauDegree = r / (degree * K);
            else if (degree == Math.Floor(K / r) + 1) tauDegree = r * Math.Log(r / delta) / K;
            var beta = idealProb + tauDegree;
            var z = tau + 1.0;
            return beta / z;
        }

        public int SampleDegree(double c = 0.1, double delta = 0.5, SeededRandom rng = null)
        {
            var rand = rng != null ? rng.Next() : new Random().NextDouble();
            double cumulative = 0;
            for (int degree = 1; degree <= K; degree++)
            {
                cumulative += RobustSoliton(degree, c, delta);
                if (rand <= cumulative) return degree;
            }
            return K;
        }

        public double[] BuildCumulativeDistribution(double c = 0.1, double delta = 0.5)
        {
            var cdf = new double[K + 1];
            double cumulative = 0;
            for (int degree = 1; degree <= K; degree++)
            {
                cumulative += RobustSoliton(degree, c, delta);
                cdf[degree] = cumulative;
            }
            return cdf;
        }

        public int SampleDegreeFromCDF(double[] cdf, SeededRandom rng = null)
        {
            var rand = rng != null ? rng.Next() : new Random().NextDouble();
            for (int degree = 1; degree < cdf.Length; degree++)
                if (rand <= cdf[degree]) return degree;
            return K;
        }
    }

    public class SeededRandom
    {
        public double Seed { get; set; }
        public SeededRandom(double seed = 1) { Seed = seed; }

        public double Next()
        {
            Seed = (Seed * 16807) % 2147483647;
            return Seed / 2147483647;
        }

        public int NextInt(int max) => (int)Math.Floor(Next() * max);

        public T[] Shuffle<T>(T[] array)
        {
            var result = (T[])array.Clone();
            for (int i = result.Length - 1; i > 0; i--)
            {
                var j = NextInt(i + 1);
                (result[i], result[j]) = (result[j], result[i]);
            }
            return result;
        }

        public T[] Sample<T>(T[] array, int count)
        {
            if (count > array.Length) throw new Exception("Cannot sample more items than available");
            var shuffled = Shuffle(array);
            return shuffled.Take(count).ToArray();
        }
    }

    public class PerformanceProfiler
    {
        private readonly Dictionary<string, double> timers = new Dictionary<string, double>();
        private readonly Dictionary<string, double> counters = new Dictionary<string, double>();

        public void StartTimer(string name) => timers[name] = Environment.TickCount64;
        public double EndTimer(string name)
        {
            if (!timers.TryGetValue(name, out var start))
                throw new Exception($"Timer {name} was not started");
            var duration = Environment.TickCount64 - start;
            timers.Remove(name);
            return duration;
        }
        public void IncrementCounter(string name, double value = 1) => counters[name] = GetCounter(name) + value;
        public double GetCounter(string name) => counters.TryGetValue(name, out var v) ? v : 0;
        public dynamic GetReport() => new { Counters = counters, ActiveTimers = timers.Keys.ToArray() };
        public void Reset() { timers.Clear(); counters.Clear(); }
    }
}

`;
    // Return: usings first, then stubs, then code without usings
    return usingBlock + '\n\n' + stubs + codeWithoutUsings;
  }

  /**
   * Generate C# test runner code from ILTestRunner node (global property)
   * @param {Object} testRunner - ILTestRunner node with test cases
   * @returns {string} C# test runner code
   */
  generateTestRunner(testRunner) {
    if (!testRunner || !testRunner.tests || testRunner.tests.length === 0) {
      return '';
    }

    const lines = [];
    lines.push('// Auto-generated Test Runner');
    lines.push('public static class TestRunner');
    lines.push('{');
    lines.push('    public static int Main(string[] args)');
    lines.push('    {');
    lines.push('        int passed = 0, failed = 0;');
    lines.push('        Console.WriteLine("Running tests...");');
    lines.push('');

    for (const testGroup of testRunner.tests) {
      const algoClass = testGroup.algorithmClass;
      const instClass = testGroup.instanceClass;

      for (let i = 0; i < testGroup.testCases.length; ++i) {
        const tc = testGroup.testCases[i];
        const desc = tc.description || `Test ${i + 1}`;
        const inputBytes = tc.input ? `new byte[] { ${tc.input.join(', ')} }` : 'new byte[0]';
        const expectedBytes = tc.expected ? `new byte[] { ${tc.expected.join(', ')} }` : 'new byte[0]';

        lines.push(`        // Test: ${desc}`);
        lines.push('        try');
        lines.push('        {');
        lines.push(`            var algo = new ${algoClass}();`);
        lines.push(`            var instance = (${instClass})algo.CreateInstance();`);

        // Set key/iv/nonce if provided
        if (tc.key) {
          lines.push(`            instance.Key = new byte[] { ${tc.key.join(', ')} };`);
        }
        if (tc.iv) {
          lines.push(`            instance.Iv = new byte[] { ${tc.iv.join(', ')} };`);
        }
        if (tc.nonce) {
          lines.push(`            instance.Nonce = new byte[] { ${tc.nonce.join(', ')} };`);
        }

        lines.push(`            byte[] input = ${inputBytes};`);
        lines.push(`            byte[] expected = ${expectedBytes};`);
        lines.push('');
        lines.push('            instance.Feed(input);');
        lines.push('            byte[] actual = instance.Result();');
        lines.push('');
        lines.push('            bool match = actual.Length == expected.Length;');
        lines.push('            if (match)');
        lines.push('            {');
        lines.push('                for (int i = 0; i < actual.Length; ++i)');
        lines.push('                {');
        lines.push('                    if (actual[i] != expected[i]) { match = false; break; }');
        lines.push('                }');
        lines.push('            }');
        lines.push('');
        lines.push('            if (match)');
        lines.push('            {');
        lines.push(`                Console.WriteLine("PASS: ${desc}");`);
        lines.push('                ++passed;');
        lines.push('            }');
        lines.push('            else');
        lines.push('            {');
        lines.push(`                Console.WriteLine("FAIL: ${desc}");`);
        lines.push('                Console.WriteLine("  Expected: " + BitConverter.ToString(expected).Replace("-", ""));');
        lines.push('                Console.WriteLine("  Actual:   " + BitConverter.ToString(actual).Replace("-", ""));');
        lines.push('                ++failed;');
        lines.push('            }');
        lines.push('        }');
        lines.push('        catch (Exception ex)');
        lines.push('        {');
        lines.push(`            Console.WriteLine("ERROR: ${desc} - " + ex.Message);`);
        lines.push('            ++failed;');
        lines.push('        }');
        lines.push('');
      }
    }

    lines.push('        Console.WriteLine();');
    lines.push('        Console.WriteLine($"Results: {passed} passed, {failed} failed");');
    lines.push('        return failed == 0 ? 0 : 1;');
    lines.push('    }');
    lines.push('}');

    return lines.join('\n');
  }
}

// Register the plugin
const csharpPlugin = new CSharpPlugin();
LanguagePlugins.Add(csharpPlugin);

// Export for potential direct use (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = csharpPlugin;
}

})(); // End of IIFE
