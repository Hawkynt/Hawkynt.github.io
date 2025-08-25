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
if (typeof require !== 'undefined') {
  // Node.js environment
  const framework = require('./LanguagePlugin.js');
  LanguagePlugin = framework.LanguagePlugin;
  LanguagePlugins = framework.LanguagePlugins;
} else {
  // Browser environment - use globals
  LanguagePlugin = window.LanguagePlugin;
  LanguagePlugins = window.LanguagePlugins;
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
    
    // Internal state
    this.indentLevel = 0;
    this.imports = new Set();
  }

  /**
   * Generate Java code from Abstract Syntax Tree
   * @param {Object} ast - Parsed/Modified AST representation
   * @param {Object} options - Generation options
   * @returns {CodeGenerationResult}
   */
  GenerateFromAST(ast, options = {}) {
    try {
      // Reset state for clean generation
      this.indentLevel = 0;
      this.imports.clear();
      
      // Merge options
      const mergedOptions = { ...this.options, ...options };
      
      // Validate AST
      if (!ast || typeof ast !== 'object') {
        return this.CreateErrorResult('Invalid AST: must be an object');
      }
      
      // Generate Java code
      const code = this._generateNode(ast, mergedOptions);
      
      // Add package declaration, imports, and class structure
      const finalCode = this._wrapWithClassStructure(code, mergedOptions);
      
      // Collect dependencies
      const dependencies = this._collectDependencies(ast, mergedOptions);
      
      // Generate warnings if any
      const warnings = this._generateWarnings(ast, mergedOptions);
      
      return this.CreateSuccessResult(finalCode, dependencies, warnings);
      
    } catch (error) {
      return this.CreateErrorResult('Code generation failed: ' + error.message);
    }
  }

  /**
   * Generate code for any AST node
   * @private
   */
  _generateNode(node, options) {
    if (!node || !node.type) {
      return '';
    }
    
    switch (node.type) {
      case 'Program':
        return this._generateProgram(node, options);
      case 'FunctionDeclaration':
        return this._generateMethod(node, options);
      case 'ClassDeclaration':
        return this._generateClass(node, options);
      case 'MethodDefinition':
        return this._generateMethodDef(node, options);
      case 'BlockStatement':
        return this._generateBlock(node, options);
      case 'VariableDeclaration':
        return this._generateVariableDeclaration(node, options);
      case 'ExpressionStatement':
        return this._generateExpressionStatement(node, options);
      case 'ReturnStatement':
        return this._generateReturnStatement(node, options);
      case 'BinaryExpression':
        return this._generateBinaryExpression(node, options);
      case 'CallExpression':
        return this._generateCallExpression(node, options);
      case 'MemberExpression':
        return this._generateMemberExpression(node, options);
      case 'AssignmentExpression':
        return this._generateAssignmentExpression(node, options);
      case 'Identifier':
        return this._generateIdentifier(node, options);
      case 'Literal':
        return this._generateLiteral(node, options);
      case 'ThisExpression':
        return 'this';
      default:
        return '// TODO: Implement ' + node.type;
    }
  }

  /**
   * Generate program (root level)
   * @private
   */
  _generateProgram(node, options) {
    if (!node.body || !Array.isArray(node.body)) {
      return '';
    }
    
    const statements = node.body
      .map(stmt => this._generateNode(stmt, options))
      .filter(code => code.trim() !== '');
    
    return statements.join('\n\n');
  }

  /**
   * Generate method (function becomes static method)
   * @private
   */
  _generateMethod(node, options) {
    const methodName = node.id ? this._toCamelCase(node.id.name) : 'unnamedMethod';
    let code = '';
    
    // Javadoc comment
    if (options.addComments) {
      code += this._indent('/**\n');
      code += this._indent(' * ' + methodName + ' method\n');
      code += this._indent(' * Performs the ' + (node.id ? node.id.name : 'unnamed') + ' operation\n');
      code += this._indent(' *\n');
      if (node.params && node.params.length > 0) {
        node.params.forEach(param => {
          const paramName = param.name || 'param';
          code += this._indent(' * @param ' + paramName + ' input parameter\n');
        });
      }
      code += this._indent(' * @return result of the operation\n');
      code += this._indent(' */\n');
    }
    
    // Method signature
    code += this._indent('public static int ' + methodName + '(');
    
    // Parameters with Java types
    if (node.params && node.params.length > 0) {
      const params = node.params.map(param => {
        const paramName = param.name || 'param';
        return 'int ' + this._toCamelCase(paramName);
      });
      code += params.join(', ');
    }
    
    code += ') {\n';
    
    // Method body
    this.indentLevel++;
    if (node.body) {
      const bodyCode = this._generateNode(node.body, options);
      code += bodyCode || this._indent('throw new UnsupportedOperationException("Not implemented");\n');
    } else {
      code += this._indent('throw new UnsupportedOperationException("Not implemented");\n');
    }
    this.indentLevel--;
    
    code += this._indent('}\n');
    
    return code;
  }

  /**
   * Generate class declaration
   * @private
   */
  _generateClass(node, options) {
    const className = node.id ? this._toPascalCase(node.id.name) : 'UnnamedClass';
    let code = '';
    
    // Class Javadoc
    if (options.addComments) {
      code += this._indent('/**\n');
      code += this._indent(' * ' + className + ' class\n');
      code += this._indent(' * Represents a ' + (node.id ? node.id.name : 'unnamed') + ' entity\n');
      code += this._indent(' */\n');
    }
    
    // Class declaration with inheritance
    if (node.superClass) {
      const superName = this._generateNode(node.superClass, options);
      code += this._indent('public class ' + className + ' extends ' + superName + ' {\n');
    } else {
      code += this._indent('public class ' + className + ' {\n');
    }
    
    // Class body
    this.indentLevel++;
    
    // Add fields section
    code += this._indent('// Fields\n');
    code += this._indent('// TODO: Add fields based on class analysis\n\n');
    
    // Methods
    if (node.body && node.body.length > 0) {
      const methods = node.body
        .map(method => this._generateNode(method, options))
        .filter(m => m.trim());
      code += methods.join('\n\n');
    }
    
    this.indentLevel--;
    code += this._indent('}\n');
    
    return code;
  }

  /**
   * Generate method definition
   * @private
   */
  _generateMethodDef(node, options) {
    if (!node.key || !node.value) return '';
    
    const methodName = this._toCamelCase(node.key.name);
    const isConstructor = node.key.name === 'constructor';
    let code = '';
    
    // Javadoc
    if (options.addComments) {
      code += this._indent('/**\n');
      code += this._indent(' * ' + (isConstructor ? 'Constructor' : methodName + ' method') + '\n');
      if (node.value.params && node.value.params.length > 0) {
        node.value.params.forEach(param => {
          const paramName = param.name || 'param';
          code += this._indent(' * @param ' + paramName + ' input parameter\n');
        });
      }
      if (!isConstructor) {
        code += this._indent(' * @return method result\n');
      }
      code += this._indent(' */\n');
    }
    
    // Method signature
    if (isConstructor) {
      // Constructor - class name should come from context
      code += this._indent('public ' + options.className + '(');
    } else {
      code += this._indent('public int ' + methodName + '(');
    }
    
    // Parameters
    if (node.value.params && node.value.params.length > 0) {
      const params = node.value.params.map(param => {
        const paramName = param.name || 'param';
        return 'int ' + this._toCamelCase(paramName);
      });
      code += params.join(', ');
    }
    
    code += ') {\n';
    
    // Method body
    this.indentLevel++;
    if (node.value.body) {
      const bodyCode = this._generateNode(node.value.body, options);
      code += bodyCode || (isConstructor ? '' : this._indent('throw new UnsupportedOperationException("Not implemented");\n'));
    } else {
      if (!isConstructor) {
        code += this._indent('throw new UnsupportedOperationException("Not implemented");\n');
      }
    }
    this.indentLevel--;
    
    code += this._indent('}\n');
    
    return code;
  }

  /**
   * Generate block statement
   * @private
   */
  _generateBlock(node, options) {
    if (!node.body || node.body.length === 0) {
      return this._indent('throw new RuntimeException("Empty block");\n');
    }
    
    return node.body
      .map(stmt => this._generateNode(stmt, options))
      .filter(line => line.trim())
      .join('\n');
  }

  /**
   * Generate variable declaration
   * @private
   */
  _generateVariableDeclaration(node, options) {
    if (!node.declarations) return '';
    
    return node.declarations
      .map(decl => {
        const varName = decl.id ? this._toCamelCase(decl.id.name) : 'variable';
        
        if (decl.init) {
          const initValue = this._generateNode(decl.init, options);
          // Java variable declaration with type
          const isFinal = node.kind === 'const';
          const modifier = isFinal ? 'final ' : '';
          return this._indent(modifier + 'int ' + varName + ' = ' + initValue + ';\n');
        } else {
          return this._indent('int ' + varName + ';\n');
        }
      })
      .join('');
  }

  /**
   * Generate expression statement
   * @private
   */
  _generateExpressionStatement(node, options) {
    const expr = this._generateNode(node.expression, options);
    return expr ? this._indent(expr + ';\n') : '';
  }

  /**
   * Generate return statement
   * @private
   */
  _generateReturnStatement(node, options) {
    if (node.argument) {
      const returnValue = this._generateNode(node.argument, options);
      return this._indent('return ' + returnValue + ';\n');
    } else {
      return this._indent('return;\n');
    }
  }

  /**
   * Generate binary expression
   * @private
   */
  _generateBinaryExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    let operator = node.operator;
    
    // Java operators
    switch (operator) {
      case '===':
        operator = '=='; // Note: in Java, use .equals() for objects
        break;
      case '!==':
        operator = '!=';
        break;
    }
    
    return left + ' ' + operator + ' ' + right;
  }

  /**
   * Generate call expression
   * @private
   */
  _generateCallExpression(node, options) {
    const callee = this._generateNode(node.callee, options);
    const args = node.arguments ? 
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';
    
    return callee + '(' + args + ')';
  }

  /**
   * Generate member expression
   * @private
   */
  _generateMemberExpression(node, options) {
    const object = this._generateNode(node.object, options);
    const property = node.computed ? 
      '[' + this._generateNode(node.property, options) + ']' : 
      '.' + this._toCamelCase(node.property.name || node.property);
    
    return object + property;
  }

  /**
   * Generate assignment expression
   * @private
   */
  _generateAssignmentExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    const operator = node.operator;
    return left + ' ' + operator + ' ' + right;
  }

  /**
   * Generate identifier
   * @private
   */
  _generateIdentifier(node, options) {
    return this._toCamelCase(node.name);
  }

  /**
   * Generate literal
   * @private
   */
  _generateLiteral(node, options) {
    if (typeof node.value === 'string') {
      return '"' + node.value.replace(/"/g, '\\"') + '"';
    } else if (node.value === null) {
      return 'null';
    } else if (typeof node.value === 'boolean') {
      return node.value ? 'true' : 'false';
    } else {
      return String(node.value);
    }
  }

  /**
   * Convert to camelCase (Java variable/method naming)
   * @private
   */
  _toCamelCase(str) {
    if (!str) return str;
    return str.charAt(0).toLowerCase() + str.slice(1);
  }

  /**
   * Convert to PascalCase (Java class naming)
   * @private
   */
  _toPascalCase(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Add proper indentation
   * @private
   */
  _indent(code) {
    const indentStr = this.options.indent.repeat(this.indentLevel);
    return code.split('\n').map(line => 
      line.trim() ? indentStr + line : line
    ).join('\n');
  }

  /**
   * Wrap generated code with class structure
   * @private
   */
  _wrapWithClassStructure(code, options) {
    let result = '';
    
    // Package declaration
    result += 'package ' + options.packageName + ';\n\n';
    
    // Imports
    if (this.imports.size > 0) {
      for (const imp of this.imports) {
        result += 'import ' + imp + ';\n';
      }
      result += '\n';
    }
    
    // File header comment
    if (options.addComments) {
      result += '/**\n';
      result += ' * Generated Java code\n';
      result += ' * This file was automatically generated from JavaScript AST\n';
      result += ' * \n';
      result += ' * @author Code Generator\n';
      result += ' * @version 1.0\n';
      result += ' */\n';
    }
    
    // Class wrapper
    result += 'public class ' + options.className + ' {\n\n';
    
    // Add main method if not present
    result += '    /**\n';
    result += '     * Main method for testing\n';
    result += '     * @param args command line arguments\n';
    result += '     */\n';
    result += '    public static void main(String[] args) {\n';
    result += '        // TODO: Add test code\n';
    result += '        System.out.println("Generated code execution");\n';
    result += '    }\n\n';
    
    // Generated code (indented)
    const indentedCode = code.split('\n').map(line => 
      line.trim() ? '    ' + line : line
    ).join('\n');
    
    result += indentedCode + '\n';
    result += '}\n';
    
    return result;
  }

  /**
   * Collect required dependencies
   * @private
   */
  _collectDependencies(ast, options) {
    const dependencies = [];
    
    // Common Java dependencies
    this.imports.add('java.util.*');
    this.imports.add('java.lang.UnsupportedOperationException');
    
    return dependencies;
  }

  /**
   * Generate warnings about potential issues
   * @private
   */
  _generateWarnings(ast, options) {
    const warnings = [];
    
    // Java-specific warnings
    warnings.push('Consider using specific types instead of int for better type safety');
    warnings.push('Add proper exception handling');
    warnings.push('Consider using Objects.equals() for object comparisons');
    warnings.push('Add proper access modifiers (private/protected/public)');
    
    return warnings;
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