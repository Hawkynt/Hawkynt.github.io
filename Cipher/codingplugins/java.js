/**
 * Java Language Plugin for Multi-Language Code Generation
 * Generates Java code from JavaScript AST
 * 
 * Follows the LanguagePlugin specification exactly
 */

// Import the framework
// Import the framework (Node.js environment)
(function() {
  // Use local variables to avoid global conflicts
  let LanguagePlugin, LanguagePlugins;
  let JavaAST, JavaEmitter, JavaTransformer;

if (typeof require !== 'undefined') {
  // Node.js environment
  const framework = require('./LanguagePlugin.js');
  LanguagePlugin = framework.LanguagePlugin;
  LanguagePlugins = framework.LanguagePlugins;

  // Load AST pipeline components (required)
  try {
    JavaAST = require('./JavaAST.js');
    const emitterModule = require('./JavaEmitter.js');
    JavaEmitter = emitterModule.JavaEmitter;
    const transformerModule = require('./JavaTransformer.js');
    JavaTransformer = transformerModule.JavaTransformer;
  } catch (e) {
    // Pipeline components not available - plugin will not function
    console.warn('Java AST pipeline components not loaded:', e.message);
  }
} else {
  // Browser environment - use globals
  LanguagePlugin = window.LanguagePlugin;
  LanguagePlugins = window.LanguagePlugins;
  JavaAST = window.JavaAST;
  JavaEmitter = window.JavaEmitter;
  JavaTransformer = window.JavaTransformer;
}

/**
 * Java Code Generator Plugin
 * Extends LanguagePlugin base class
 */
class JavaPlugin extends LanguagePlugin {
  constructor() {
    super();
    
    // Required plugin metadata
    this.name = 'Java';
    this.extension = 'java';
    this.icon = '☕';
    this.description = 'Java language code generator';
    this.mimeType = 'text/x-java';
    this.version = 'Java 17+';
    
    // Java-specific options
    this.options = {
      indent: '    ', // 4 spaces (Java convention)
      lineEnding: '\n',
      addComments: true,
      useStrictTypes: true,
      packageName: 'com.generated',
      className: 'GeneratedClass'
    };
  }

  /**
   * Generate Java code from Abstract Syntax Tree
   * Uses AST pipeline: JS AST -> Java AST -> Java Emitter -> Java Source
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

      // Validate AST pipeline components are available
      if (!JavaTransformer || !JavaEmitter) {
        return this.CreateErrorResult('Java AST pipeline components not available');
      }

      // Create transformer with options
      const transformer = new JavaTransformer({
        packageName: mergedOptions.packageName || 'com.generated',
        className: mergedOptions.className || 'GeneratedClass',
        typeKnowledge: mergedOptions.parser?.typeKnowledge || mergedOptions.typeKnowledge
      });

      // Transform JS AST to Java AST
      const javaAst = transformer.transform(ast);

      // Create emitter with formatting options
      const emitter = new JavaEmitter({
        indent: mergedOptions.indent || '    ',
        newline: mergedOptions.lineEnding || '\n'
      });

      // Emit Java source code
      const code = emitter.emit(javaAst);

      // Collect any warnings from transformation
      const warnings = transformer.warnings || [];

      return this.CreateSuccessResult(code, [], warnings);

    } catch (error) {
      return this.CreateErrorResult('AST pipeline generation failed: ' + error.message);
    }
  }


  /**
   * Check if Java compiler is available on the system
   * @private
   */
  _isJavaAvailable() {
    try {
      const { execSync } = require('child_process');
      execSync('javac -version', { 
        stdio: 'pipe', 
        timeout: 1000,
        windowsHide: true  // Prevent Windows error dialogs
      });
      return true;
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
          // Special handling for < in Java - only count as opening if it looks like a generic
          if (char === '<') {
            // Simple heuristic: check if this could be a generic type parameter
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
   * Validate Java code syntax using javac
   * @override
   */
  ValidateCodeSyntax(code) {
    // Check if Java compiler is available first
    const javacAvailable = this._isJavaAvailable();
    if (!javacAvailable) {
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'Java compiler not available - using basic validation'
      };
    }

    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');
      
      // Create temporary file
      const tempFile = path.join(__dirname, '..', '.agent.tmp', `TempJavaClass_${Date.now()}.java`);
      
      // Ensure .agent.tmp directory exists
      const tempDir = path.dirname(tempFile);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Wrap code in a basic class structure if needed
      let javaCode = code;
      if (!code.includes('class ') && !code.includes('interface ') && !code.includes('enum ')) {
        const className = path.basename(tempFile, '.java');
        javaCode = `public class ${className} {\n${code}\n}`;
      }
      
      // Write code to temp file
      fs.writeFileSync(tempFile, javaCode);
      
      try {
        // Try to compile the Java code
        execSync(`javac "${tempFile}"`, { 
          stdio: 'pipe',
          timeout: 3000,
          cwd: path.dirname(tempFile),
          windowsHide: true  // Prevent Windows error dialogs
        });
        
        // Clean up source file
        fs.unlinkSync(tempFile);
        
        // Clean up compiled class file if it exists
        const classFile = tempFile.replace('.java', '.class');
        if (fs.existsSync(classFile)) {
          fs.unlinkSync(classFile);
        }
        
        return {
          success: true,
          method: 'javac',
          error: null
        };
        
      } catch (error) {
        // Clean up on error
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
        const classFile = tempFile.replace('.java', '.class');
        if (fs.existsSync(classFile)) {
          fs.unlinkSync(classFile);
        }
        
        return {
          success: false,
          method: 'javac',
          error: error.stderr?.toString() || error.message
        };
      }
      
    } catch (error) {
      // If Java compiler is not available or other error, fall back to basic validation
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'Java compiler not available - using basic validation'
      };
    }
  }

  /**
   * Get Java compiler download information
   * @override
   */
  GetCompilerInfo() {
    return {
      name: this.name,
      compilerName: 'Java Development Kit (JDK)',
      downloadUrl: 'https://www.oracle.com/java/technologies/downloads/',
      installInstructions: [
        'Download JDK from https://www.oracle.com/java/technologies/downloads/',
        'Or use OpenJDK from https://openjdk.org/',
        'Install the JDK package for your operating system',
        'Add JAVA_HOME and update PATH environment variables',
        'Verify installation with: javac -version'
      ].join('\n'),
      verifyCommand: 'javac -version',
      alternativeValidation: 'Basic syntax checking (balanced brackets/parentheses with Java generics)',
      packageManager: 'Maven/Gradle',
      documentation: 'https://docs.oracle.com/en/java/'
    };
  }
}

// Register the plugin
const javaPlugin = new JavaPlugin();
LanguagePlugins.Add(javaPlugin);

// Export for potential direct use
// Export for potential direct use (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = javaPlugin;
}


})(); // End of IIFE