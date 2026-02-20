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
} else {
  // Browser environment - use globals
  LanguagePlugin = window.LanguagePlugin;
  LanguagePlugins = window.LanguagePlugins;
  CSharpAST = window.CSharpAST;
  CSharpEmitter = window.CSharpEmitter;
  CSharpTransformer = window.CSharpTransformer;
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
        typeKnowledge: mergedOptions.parser?.typeKnowledge || mergedOptions.typeKnowledge
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
    public enum CategoryType { CHECKSUM, BLOCK, STREAM, HASH, MAC, KDF, AEAD, ASYMMETRIC, COMPRESSION, ENCODING, CLASSICAL, ECC, RANDOM, MODES, MODE, CRYPTO, SPECIAL }
    public enum SecurityStatus { SECURE, EDUCATIONAL, DEPRECATED, BROKEN, EXPERIMENTAL, OBSOLETE, INSECURE }
    public enum CountryCode { US, DE, JP, FR, GB, CN, RU, BE, KR, IL, CH, AU, NL, AT, FI, SE, NO, DK, IT, ES, CA, OTHER, INTERNATIONAL, ANCIENT, AUSTRIA, BR, CR, EU, FRANCE, GR, ID, IN, INT, INTL, MULTI, NETHERLANDS, PL, PT, SG, SINGAPORE, TR, UA, UK, UNKNOWN, ZA }
    public enum ComplexityType { BEGINNER, INTERMEDIATE, ADVANCED, EXPERT, RESEARCH }

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
    public abstract class HashFunctionAlgorithm : Algorithm { public int DigestSize { get; set; } public int OutputSize { get; set; } public int BlockSize { get; set; } public int[] SupportedOutputSizes { get; set; } }
    public abstract class AeadAlgorithm : CryptoAlgorithm { }
    public abstract class MacAlgorithm : Algorithm { }
    public abstract class KdfAlgorithm : Algorithm { public bool SaltRequired { get; set; } public int[] SupportedOutputSizes { get; set; } }
    public abstract class ChecksumAlgorithm : Algorithm { }
    public abstract class CompressionAlgorithm : Algorithm { }
    public abstract class RandomAlgorithm : Algorithm { }
    public abstract class RandomGenerationAlgorithm : Algorithm { }
    public abstract class ClassicalCipherAlgorithm : Algorithm { }
    public abstract class EncodingAlgorithm : Algorithm { }
    public abstract class AsymmetricAlgorithm : Algorithm { }
    public abstract class PaddingAlgorithm : Algorithm { }
    public abstract class PermutationAlgorithm : Algorithm { }
    public abstract class ModeAlgorithm : Algorithm { }
    public abstract class CipherModeAlgorithm : Algorithm { }
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
        public virtual void Feed(byte[] data) { }
        public virtual byte[] Result() { return Array.Empty<byte>(); }
    }

    // Algorithm-specific instance base classes
    public abstract class IBlockCipherInstance : IAlgorithmInstance
    {
        protected IBlockCipherInstance(Algorithm algo) : base(algo) { }
        public byte[] Key { get; set; }
        public byte[] IV { get; set; }
    }

    public abstract class IStreamCipherInstance : IAlgorithmInstance
    {
        protected IStreamCipherInstance(Algorithm algo) : base(algo) { }
        public byte[] Key { get; set; }
        public byte[] IV { get; set; }
        public byte[] Nonce { get; set; }
    }

    public abstract class IHashFunctionInstance : IAlgorithmInstance
    {
        protected IHashFunctionInstance(Algorithm algo) : base(algo) { }
        public int OutputSize { get; set; }
    }

    public abstract class IMacInstance : IAlgorithmInstance
    {
        protected IMacInstance(Algorithm algo) : base(algo) { }
        public byte[] Key { get; set; }
    }

    public abstract class IAeadInstance : IAlgorithmInstance
    {
        protected IAeadInstance(Algorithm algo) : base(algo) { }
        public byte[] Key { get; set; }
        public byte[] Nonce { get; set; }
        public byte[] AssociatedData { get; set; }
    }

    public abstract class IKdfInstance : IAlgorithmInstance
    {
        protected IKdfInstance(Algorithm algo) : base(algo) { }
        public byte[] Salt { get; set; }
        public int Iterations { get; set; }
        public int OutputLength { get; set; }
    }

    public abstract class ICompressionInstance : IAlgorithmInstance
    {
        protected ICompressionInstance(Algorithm algo) : base(algo) { }
    }

    public abstract class IRandomInstance : IAlgorithmInstance
    {
        protected IRandomInstance(Algorithm algo) : base(algo) { }
        public byte[] Seed { get; set; }
    }

    public abstract class IChecksumInstance : IAlgorithmInstance
    {
        protected IChecksumInstance(Algorithm algo) : base(algo) { }
    }

    public abstract class IErrorCorrectionInstance : IAlgorithmInstance
    {
        protected IErrorCorrectionInstance(Algorithm algo) : base(algo) { }
        // Note: Algorithms use this._result field for intermediate storage
        // and override Result() method to return it
    }

    public abstract class IClassicalCipherInstance : IAlgorithmInstance
    {
        protected IClassicalCipherInstance(Algorithm algo) : base(algo) { }
        public string Key { get; set; }
    }

    public abstract class IEncodingInstance : IAlgorithmInstance
    {
        protected IEncodingInstance(Algorithm algo) : base(algo) { }
    }

    public abstract class IRandomGeneratorInstance : IAlgorithmInstance
    {
        protected IRandomGeneratorInstance(Algorithm algo) : base(algo) { }
        public byte[] Seed { get; set; }
        public int OutputLength { get; set; }
    }

    public abstract class ICipherModeInstance : IAlgorithmInstance
    {
        protected ICipherModeInstance(Algorithm algo) : base(algo) { }
        public byte[] Key { get; set; }
        public byte[] IV { get; set; }
        public dynamic UnderlyingCipher { get; set; }
    }

    public abstract class IAsymmetricCipherInstance : IAlgorithmInstance
    {
        protected IAsymmetricCipherInstance(Algorithm algo) : base(algo) { }
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
        public byte[] Input { get; }
        public byte[] Expected { get; }
        public string Description { get; }
        public string Source { get; }
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
        public static byte[] ConcatArrays(byte[] a, byte[] b) {
            var result = new byte[a.Length + b.Length];
            System.Array.Copy(a, 0, result, 0, a.Length);
            System.Array.Copy(b, 0, result, a.Length, b.Length);
            return result;
        }
        public static byte[] SliceArray(byte[] arr, int start, int end) {
            var result = new byte[end - start];
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
        // Byte extraction from multi-byte values
        public static byte GetByte(uint v, int index) => (byte)(v >> (index * 8));
        public static byte GetByte(ulong v, int index) => (byte)(v >> (index * 8));
        public static byte GetByte(int v, int index) => (byte)(v >> (index * 8));
        public static byte GetByte(long v, int index) => (byte)(v >> (index * 8));
        // SetByte - set byte at position
        public static uint SetByte(uint v, int index, byte b) => (v & ~(0xFFu << (index * 8))) | ((uint)b << (index * 8));
        public static ulong SetByte(ulong v, int index, byte b) => (v & ~(0xFFuL << (index * 8))) | ((ulong)b << (index * 8));
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
    }

    // Global helper functions (without OpCodes prefix)
    public static class Helpers
    {
        public static byte[] XorArrays(byte[] a, byte[] b) => OpCodes.XorArrays(a, b);
        public static byte[] ConcatArrays(byte[] a, byte[] b) => OpCodes.ConcatArrays(a, b);
        public static byte[] SliceArray(byte[] arr, int start, int end) => OpCodes.SliceArray(arr, start, end);
        public static uint RotL32(uint v, int n) => OpCodes.RotL32(v, n);
        public static uint RotR32(uint v, int n) => OpCodes.RotR32(v, n);
        public static ulong RotL64(ulong v, int n) => OpCodes.RotL64(v, n);
        public static ulong RotR64(ulong v, int n) => OpCodes.RotR64(v, n);
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
