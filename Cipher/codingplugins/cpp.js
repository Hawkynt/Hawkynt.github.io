/**
 * C++ Language Plugin for Multi-Language Code Generation
 * Generates C++ code from JavaScript AST
 * 
 * Follows the LanguagePlugin specification exactly
 */

// Import the framework
// Import the framework (Node.js environment)
(function() {
  // Use local variables to avoid global conflicts
  let LanguagePlugin, LanguagePlugins;
  let CppAST, CppEmitter, CppTransformer;

if (typeof require !== 'undefined') {
  // Node.js environment
  const framework = require('./LanguagePlugin.js');
  LanguagePlugin = framework.LanguagePlugin;
  LanguagePlugins = framework.LanguagePlugins;

  // Load AST pipeline components (REQUIRED)
  try {
    CppAST = require('./CppAST.js');
    const emitterModule = require('./CppEmitter.js');
    CppEmitter = emitterModule.CppEmitter;
    const transformerModule = require('./CppTransformer.js');
    CppTransformer = transformerModule.CppTransformer;
  } catch (e) {
    // Pipeline components not available - plugin will not work
    console.error('C++ AST pipeline components not loaded:', e.message);
    console.error('C++ plugin requires CppTransformer and CppEmitter to function');
  }
} else {
  // Browser environment - use globals
  LanguagePlugin = window.LanguagePlugin;
  LanguagePlugins = window.LanguagePlugins;
  CppAST = window.CppAST;
  CppEmitter = window.CppEmitter;
  CppTransformer = window.CppTransformer;
}

/**
 * C++ Code Generator Plugin
 * Extends LanguagePlugin base class
 */
class CppPlugin extends LanguagePlugin {
  constructor() {
    super();
    
    // Required plugin metadata
    this.name = 'C++';
    this.extension = 'cpp';
    this.icon = '🔧';
    this.description = 'C++ language code generator';
    this.mimeType = 'text/x-c++src';
    this.version = 'C++11/14/17/20';
    
    // C++-specific options
    this.options = {
      indent: '    ', // 4 spaces
      lineEnding: '\n',
      addComments: true,
      useNamespaces: true,
      cppStandard: 'cpp20', // cpp98, cpp03, cpp11, cpp14, cpp17, cpp20
      useSmartPointers: true,
      useModernSyntax: true,
      addHeaders: true,
      useConstexpr: true,
      useTemplates: true,
      useConcepts: true,
      useRanges: true,
      useSimd: false, // Enable SIMD optimizations
      useCoroutines: false // Enable coroutines for async crypto
    };

    // Option metadata - defines enum choices
    this.optionsMeta = {
      cppStandard: {
        type: 'enum',
        choices: [
          { value: 'cpp98', label: 'C++98', description: 'ISO C++ 1998 standard' },
          { value: 'cpp03', label: 'C++03', description: 'ISO C++ 2003 standard' },
          { value: 'cpp11', label: 'C++11', description: 'ISO C++ 2011 with auto, lambdas, move semantics' },
          { value: 'cpp14', label: 'C++14', description: 'ISO C++ 2014 with generic lambdas' },
          { value: 'cpp17', label: 'C++17', description: 'ISO C++ 2017 with structured bindings' },
          { value: 'cpp20', label: 'C++20', description: 'ISO C++ 2020 with concepts, ranges, coroutines' },
          { value: 'cpp23', label: 'C++23', description: 'ISO C++ 2023 with modules, constexpr improvements' }
        ]
      },
      indent: {
        type: 'enum',
        choices: [
          { value: '  ', label: '2 Spaces' },
          { value: '    ', label: '4 Spaces' },
          { value: '\t', label: 'Tab' }
        ]
      }
    };

    // Option constraints
    this.optionConstraints = {
      useConcepts: {
        enabledWhen: { cppStandard: ['cpp20', 'cpp23'] },
        disabledReason: 'Concepts require C++20 or later'
      },
      useRanges: {
        enabledWhen: { cppStandard: ['cpp20', 'cpp23'] },
        disabledReason: 'Ranges require C++20 or later'
      },
      useCoroutines: {
        enabledWhen: { cppStandard: ['cpp20', 'cpp23'] },
        disabledReason: 'Coroutines require C++20 or later'
      },
      useConstexpr: {
        enabledWhen: { cppStandard: ['cpp11', 'cpp14', 'cpp17', 'cpp20', 'cpp23'] },
        disabledReason: 'constexpr requires C++11 or later'
      },
      useSmartPointers: {
        enabledWhen: { cppStandard: ['cpp11', 'cpp14', 'cpp17', 'cpp20', 'cpp23'] },
        disabledReason: 'Smart pointers require C++11 or later'
      }
    };

  }

  /**
   * Check if current C++ standard is at least the specified level
   * @private
   */
  _isStandardAtLeast(options, minStandard) {
    const current = options.cppStandard || 'cpp20';
    const levels = { 'cpp98': 1, 'cpp03': 2, 'cpp11': 3, 'cpp14': 4, 'cpp17': 5, 'cpp20': 6, 'cpp23': 7 };
    const minLevel = levels[minStandard] || 0;
    const currentLevel = levels[current] || 6;
    return currentLevel >= minLevel;
  }

  /**
   * Check if C++11 or later
   * @private
   */
  _isCpp11OrLater(options) {
    return this._isStandardAtLeast(options, 'cpp11');
  }

  /**
   * Check if C++14 or later
   * @private
   */
  _isCpp14OrLater(options) {
    return this._isStandardAtLeast(options, 'cpp14');
  }

  /**
   * Check if C++17 or later
   * @private
   */
  _isCpp17OrLater(options) {
    return this._isStandardAtLeast(options, 'cpp17');
  }

  /**
   * Check if C++20 or later
   * @private
   */
  _isCpp20OrLater(options) {
    return this._isStandardAtLeast(options, 'cpp20');
  }

  /**
   * Check if C++23 or later
   * @private
   */
  _isCpp23OrLater(options) {
    return this._isStandardAtLeast(options, 'cpp23');
  }

  /**
   * Get auto keyword usage based on standard
   * @private
   */
  _supportsAuto(options) {
    return this._isCpp11OrLater(options);
  }

  /**
   * Get constexpr keyword based on standard
   * @private
   */
  _supportsConstexpr(options) {
    return this._isCpp11OrLater(options);
  }

  /**
   * Get extended constexpr (relaxed constexpr) based on standard
   * @private
   */
  _supportsExtendedConstexpr(options) {
    return this._isCpp14OrLater(options);
  }

  /**
   * Get if constexpr based on standard
   * @private
   */
  _supportsIfConstexpr(options) {
    return this._isCpp17OrLater(options);
  }

  /**
   * Get concepts support
   * @private
   */
  _supportsConcepts(options) {
    return this._isCpp20OrLater(options) && options.useConcepts;
  }

  /**
   * Get ranges support
   * @private
   */
  _supportsRanges(options) {
    return this._isCpp20OrLater(options) && options.useRanges;
  }

  /**
   * Get coroutines support
   * @private
   */
  _supportsCoroutines(options) {
    return this._isCpp20OrLater(options) && options.useCoroutines;
  }

  /**
   * Get modules support
   * @private
   */
  _supportsModules(options) {
    return this._isCpp20OrLater(options);
  }

  /**
   * Get lambda expression syntax based on standard
   * @private
   */
  _supportsLambdas(options) {
    return this._isCpp11OrLater(options);
  }

  /**
   * Get generic lambdas support
   * @private
   */
  _supportsGenericLambdas(options) {
    return this._isCpp14OrLater(options);
  }

  /**
   * Get structured bindings support
   * @private
   */
  _supportsStructuredBindings(options) {
    return this._isCpp17OrLater(options);
  }

  /**
   * Get init-statement in if/switch support
   * @private
   */
  _supportsInitStatementInIf(options) {
    return this._isCpp17OrLater(options);
  }

  /**
   * Get [[nodiscard]] attribute support
   * @private
   */
  _supportsNodiscard(options) {
    return this._isCpp17OrLater(options);
  }

  /**
   * Get [[likely]]/[[unlikely]] attribute support
   * @private
   */
  _supportsLikelyUnlikely(options) {
    return this._isCpp20OrLater(options);
  }

  /**
   * Get appropriate nullptr or NULL based on standard
   * @private
   */
  _getNullPtr(options) {
    return this._isCpp11OrLater(options) ? 'nullptr' : 'NULL';
  }


  /**
   * Generate C++ code from Abstract Syntax Tree
   * @param {Object} ast - Parsed/Modified AST representation
   * @param {Object} options - Generation options
   * @returns {CodeGenerationResult}
   */
  GenerateFromAST(ast, options = {}) {
    try {
      // Merge options
      const mergedOptions = { ...this.options, ...options };

      // Validate AST
      if (!ast || typeof ast !== 'object') {
        return this.CreateErrorResult('Invalid AST: must be an object');
      }

      // Verify AST pipeline components are available
      if (!CppTransformer || !CppEmitter) {
        return this.CreateErrorResult('C++ AST pipeline components not available');
      }

      // Create transformer with options
      const transformer = new CppTransformer({
        namespace: mergedOptions.namespace || 'generated',
        className: mergedOptions.className || 'GeneratedClass',
        typeKnowledge: mergedOptions.parser?.typeKnowledge || mergedOptions.typeKnowledge
      });

      // Transform JS AST to C++ AST
      const cppAst = transformer.transform(ast);

      // Create emitter with formatting options
      const emitter = new CppEmitter({
        indent: mergedOptions.indent || '    ',
        lineEnding: mergedOptions.lineEnding || '\n',
        braceStyle: mergedOptions.braceStyle || 'knr'
      });

      // Emit C++ source code
      const code = emitter.emit(cppAst);

      // Collect any warnings from transformation
      const warnings = transformer.warnings || [];

      return this.CreateSuccessResult(code, [], warnings);

    } catch (error) {
      return this.CreateErrorResult('Code generation failed: ' + error.message);
    }
  }


  /**
   * Check if C++ compiler is available on the system
   * @private
   */
  _isCppCompilerAvailable() {
    const compilers = [
      { cmd: 'g++', name: 'gcc' },
      { cmd: 'clang++', name: 'clang' },
      { cmd: 'cl', name: 'msvc' }
    ];

    try {
      const { execSync } = require('child_process');
      
      for (const compiler of compilers) {
        try {
          if (compiler.cmd === 'cl') {
            // MSVC compiler check
            execSync('cl 2>&1', { 
              stdio: 'pipe', 
              timeout: 1000,
              windowsHide: true
            });
          } else {
            // GCC/Clang compiler check
            execSync(`${compiler.cmd} --version`, { 
              stdio: 'pipe', 
              timeout: 1000,
              windowsHide: true
            });
          }
          return compiler.name;
        } catch (error) {
          // Continue to next compiler
          continue;
        }
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Basic syntax validation using bracket/parentheses matching
   * @private
   */
  _checkBalancedSyntax(code) {
    try {
      const stack = [];
      const pairs = { '(': ')', '[': ']', '{': '}', '<': '>' };
      const opening = Object.keys(pairs);
      const closing = Object.values(pairs);
      
      for (let i = 0; i < code.length; i++) {
        const char = code[i];
        
        // Skip string literals
        if (char === '"') {
          i++; // Skip opening quote
          while (i < code.length && code[i] !== '"') {
            if (code[i] === '\\') i++; // Skip escaped characters
            i++;
          }
          continue;
        }
        
        // Skip character literals
        if (char === "'") {
          i++; // Skip opening quote
          while (i < code.length && code[i] !== "'") {
            if (code[i] === '\\') i++; // Skip escaped characters
            i++;
          }
          continue;
        }
        
        // Skip single-line comments
        if (char === '/' && i + 1 < code.length && code[i + 1] === '/') {
          while (i < code.length && code[i] !== '\n') i++;
          continue;
        }
        
        // Skip multi-line comments
        if (char === '/' && i + 1 < code.length && code[i + 1] === '*') {
          i += 2;
          while (i < code.length - 1) {
            if (code[i] === '*' && code[i + 1] === '/') {
              i += 2;
              break;
            }
            i++;
          }
          continue;
        }
        
        if (opening.includes(char)) {
          // Special handling for < in C++ - only count as opening if it looks like a template
          if (char === '<') {
            // Simple heuristic: check if this could be a template parameter
            const nextChars = code.slice(i + 1, i + 10);
            if (!/^[A-Za-z_]/.test(nextChars)) continue;
          }
          stack.push(char);
        } else if (closing.includes(char)) {
          if (char === '>') {
            // Only match > with < if we have an unmatched <
            if (stack.length === 0 || stack[stack.length - 1] !== '<') continue;
          }
          if (stack.length === 0) return false;
          const lastOpening = stack.pop();
          if (pairs[lastOpening] !== char) return false;
        }
      }
      
      return stack.length === 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate C++ code syntax using available compiler
   * @override
   */
  ValidateCodeSyntax(code) {
    // Check if C++ compiler is available first
    const cppCompiler = this._isCppCompilerAvailable();
    if (!cppCompiler) {
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'C++ compiler not available - using basic validation'
      };
    }

    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');
      
      // Create temporary file
      const tempFile = path.join(__dirname, '..', '.agent.tmp', `temp_cpp_${Date.now()}.cpp`);
      
      // Ensure .agent.tmp directory exists
      const tempDir = path.dirname(tempFile);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Wrap code in a basic program structure if needed
      let cppCode = code;
      if (!code.includes('#include') && !code.includes('int main')) {
        cppCode = `#include <iostream>\n#include <string>\nusing namespace std;\n\n${code}\n\nint main() { return 0; }`;
      }
      
      // Write code to temp file
      fs.writeFileSync(tempFile, cppCode);
      
      try {
        let compileCommand;
        const objFile = tempFile.replace('.cpp', '.o');
        const exeFile = tempFile.replace('.cpp', '.exe');
        
        // Choose compile command based on available compiler
        switch (cppCompiler) {
          case 'gcc':
            compileCommand = `g++ -fsyntax-only -std=c++17 -Wall -Wextra -pedantic "${tempFile}"`;
            break;
          case 'clang':
            compileCommand = `clang++ -fsyntax-only -std=c++17 -Wall -Wextra -pedantic "${tempFile}"`;
            break;
          case 'msvc':
            compileCommand = `cl /c /EHsc /std:c++17 "${tempFile}"`;
            break;
          default:
            throw new Error('Unknown compiler type');
        }
        
        // Try to compile the C++ code
        execSync(compileCommand, { 
          stdio: 'pipe',
          timeout: 3000,
          cwd: path.dirname(tempFile),
          windowsHide: true  // Prevent Windows error dialogs
        });
        
        // Clean up files
        [tempFile, objFile, exeFile].forEach(file => {
          if (fs.existsSync(file)) {
            try { fs.unlinkSync(file); } catch (e) { /* ignore */ }
          }
        });
        
        return {
          success: true,
          method: cppCompiler,
          error: null
        };
        
      } catch (error) {
        // Clean up on error
        const objFile = tempFile.replace('.cpp', '.o');
        const exeFile = tempFile.replace('.cpp', '.exe');
        [tempFile, objFile, exeFile].forEach(file => {
          if (fs.existsSync(file)) {
            try { fs.unlinkSync(file); } catch (e) { /* ignore */ }
          }
        });
        
        return {
          success: false,
          method: cppCompiler,
          error: error.stderr?.toString() || error.message
        };
      }
      
    } catch (error) {
      // If C++ compiler is not available or other error, fall back to basic validation
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'C++ compiler not available - using basic validation'
      };
    }
  }

  /**
   * Get C++ compiler download information
   * @override
   */
  GetCompilerInfo() {
    return {
      name: this.name,
      compilerName: 'C++ Compiler',
      downloadUrl: 'https://gcc.gnu.org/ or https://clang.llvm.org/',
      installInstructions: [
        'GCC: Download from https://gcc.gnu.org/ or use package manager',
        'Clang: Download from https://clang.llvm.org/',
        'Windows: Install MinGW-w64, MSYS2, or Visual Studio',
        'Linux: sudo apt install g++ (Ubuntu) or equivalent',
        'macOS: Install Xcode Command Line Tools',
        'Verify installation with: g++ --version or clang++ --version'
      ].join('\n'),
      verifyCommand: 'g++ --version',
      alternativeValidation: 'Basic syntax checking (balanced brackets/parentheses with C++ templates)',
      packageManager: 'Conan/vcpkg',
      documentation: 'https://en.cppreference.com/'
    };
  }

  /**
   * Generate C++ test runner code from ILTestRunner node
   * @param {Object} testRunner - ILTestRunner node with test cases
   * @returns {string} C++ test runner code
   */
  generateTestRunner(testRunner) {
    if (!testRunner || !testRunner.tests || testRunner.tests.length === 0) {
      return '';
    }

    const lines = [];
    lines.push('// Auto-generated Test Runner');
    lines.push('#include <iostream>');
    lines.push('#include <vector>');
    lines.push('#include <cstdint>');
    lines.push('#include <iomanip>');
    lines.push('#include <string>');
    lines.push('');
    lines.push('using namespace std;');
    lines.push('');
    lines.push('// Helper function to convert byte array to hex string');
    lines.push('string toHex(const vector<uint8_t>& bytes) {');
    lines.push('    ostringstream oss;');
    lines.push('    for (auto b : bytes) {');
    lines.push('        oss << hex << setw(2) << setfill(\'0\') << (int)b;');
    lines.push('    }');
    lines.push('    return oss.str();');
    lines.push('}');
    lines.push('');
    lines.push('int main() {');
    lines.push('    int passed = 0, failed = 0;');
    lines.push('    cout << "Running tests..." << endl;');
    lines.push('    cout << endl;');
    lines.push('');

    for (const testGroup of testRunner.tests) {
      const algoClass = testGroup.algorithmClass;
      const instClass = testGroup.instanceClass;

      for (let i = 0; i < testGroup.testCases.length; ++i) {
        const tc = testGroup.testCases[i];
        const desc = tc.description || `Test ${i + 1}`;
        const inputBytes = tc.input ? `{ ${tc.input.join(', ')} }` : '{}';
        const expectedBytes = tc.expected ? `{ ${tc.expected.join(', ')} }` : '{}';

        lines.push(`    // Test: ${desc}`);
        lines.push('    try {');
        lines.push(`        ${algoClass} algo;`);
        lines.push(`        auto instance = dynamic_cast<${instClass}*>(algo.CreateInstance());`);
        lines.push('');

        // Set key/iv/nonce if provided
        if (tc.key) {
          lines.push(`        vector<uint8_t> key = { ${tc.key.join(', ')} };`);
          lines.push('        instance->SetKey(key);');
        }
        if (tc.iv) {
          lines.push(`        vector<uint8_t> iv = { ${tc.iv.join(', ')} };`);
          lines.push('        instance->SetIv(iv);');
        }
        if (tc.nonce) {
          lines.push(`        vector<uint8_t> nonce = { ${tc.nonce.join(', ')} };`);
          lines.push('        instance->SetNonce(nonce);');
        }

        lines.push(`        vector<uint8_t> input = ${inputBytes};`);
        lines.push(`        vector<uint8_t> expected = ${expectedBytes};`);
        lines.push('');
        lines.push('        instance->Feed(input);');
        lines.push('        vector<uint8_t> actual = instance->Result();');
        lines.push('');
        lines.push('        bool match = (actual.size() == expected.size());');
        lines.push('        if (match) {');
        lines.push('            for (size_t i = 0; i < actual.size(); ++i) {');
        lines.push('                if (actual[i] != expected[i]) {');
        lines.push('                    match = false;');
        lines.push('                    break;');
        lines.push('                }');
        lines.push('            }');
        lines.push('        }');
        lines.push('');
        lines.push('        if (match) {');
        lines.push(`            cout << "PASS: ${desc}" << endl;`);
        lines.push('            ++passed;');
        lines.push('        } else {');
        lines.push(`            cout << "FAIL: ${desc}" << endl;`);
        lines.push('            cout << "  Expected: " << toHex(expected) << endl;');
        lines.push('            cout << "  Actual:   " << toHex(actual) << endl;');
        lines.push('            ++failed;');
        lines.push('        }');
        lines.push('');
        lines.push('        delete instance;');
        lines.push('    } catch (const exception& ex) {');
        lines.push(`        cout << "ERROR: ${desc} - " << ex.what() << endl;`);
        lines.push('        ++failed;');
        lines.push('    }');
        lines.push('');
      }
    }

    lines.push('    cout << endl;');
    lines.push('    cout << "Results: " << passed << " passed, " << failed << " failed" << endl;');
    lines.push('    return (failed == 0) ? 0 : 1;');
    lines.push('}');

    return lines.join('\n');
  }
}

// Register the plugin
const cppPlugin = new CppPlugin();
LanguagePlugins.Add(cppPlugin);

// Export for potential direct use
// Export for potential direct use (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = cppPlugin;
}


})(); // End of IIFE