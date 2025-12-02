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
      namespace: 'Generated',
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
        namespace: mergedOptions.namespace || 'Generated',
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
      const code = emitter.emit(csAst);

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
}

// Register the plugin
const csharpPlugin = new CSharpPlugin();
LanguagePlugins.Add(csharpPlugin);

// Export for potential direct use (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = csharpPlugin;
}

})(); // End of IIFE
