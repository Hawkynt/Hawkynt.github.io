/**
 * Go Language Plugin for Multi-Language Code Generation
 * Generates Go code from JavaScript AST
 *
 * Follows the LanguagePlugin specification exactly
 *
 * Supports two generation modes:
 * 1. Direct emission (legacy) - _generateNode directly emits Go code
 * 2. AST pipeline (new) - JS AST -> Go AST -> Go Emitter
 */

// Import the framework
// Import the framework (Node.js environment)
(function() {
  // Use local variables to avoid global conflicts
  let LanguagePlugin, LanguagePlugins;
  let GoAST, GoEmitter, GoTransformer;

  if (typeof require !== 'undefined') {
    // Node.js environment
    const framework = require('./LanguagePlugin.js');
    LanguagePlugin = framework.LanguagePlugin;
    LanguagePlugins = framework.LanguagePlugins;

    // Load new AST pipeline components
    try {
      GoAST = require('./GoAST.js');
      const emitterModule = require('./GoEmitter.js');
      GoEmitter = emitterModule.GoEmitter;
      const transformerModule = require('./GoTransformer.js');
      GoTransformer = transformerModule.GoTransformer;
    } catch (e) {
      // Pipeline components not available - will use legacy mode
      console.warn('Go AST pipeline components not loaded:', e.message);
    }
  } else {
    // Browser environment - use globals
    LanguagePlugin = window.LanguagePlugin;
    LanguagePlugins = window.LanguagePlugins;
    GoAST = window.GoAST;
    GoEmitter = window.GoEmitter;
    GoTransformer = window.GoTransformer;
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
      packageName: 'main',
      addComments: true,
      useStrictTypes: true,
      errorHandling: true,
      useInterfaces: true,
      useGoroutines: true,
      useCrypto: true,
      useGenerics: true, // Go 1.18+
      useContext: true,
      useChannels: true,
      useAstPipeline: true // Enable new AST pipeline by default
    };

    // Internal state
    this.indentLevel = 0;
    this.imports = new Set();
  }

  /**
   * Generate Go code from Abstract Syntax Tree
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

      // Check if new AST pipeline is requested and available
      if (mergedOptions.useAstPipeline && GoTransformer && GoEmitter) {
        return this._generateWithAstPipeline(ast, mergedOptions);
      }

      // Fallback to legacy direct emission
      return this._generateWithDirectEmission(ast, mergedOptions);

    } catch (error) {
      return this.CreateErrorResult(`Code generation failed: ${error.message}`);
    }
  }

  /**
   * Generate code using new AST pipeline: JS AST -> Go AST -> Go Emitter
   * @private
   */
  _generateWithAstPipeline(jsAst, options) {
    try {
      // Step 1: Transform JS AST to Go AST
      const transformer = new GoTransformer({
        packageName: options.packageName,
        typeKnowledge: options.typeKnowledge,
        addComments: options.addComments,
        useStrictTypes: options.useStrictTypes,
        errorHandling: options.errorHandling,
        useInterfaces: options.useInterfaces,
        useGoroutines: options.useGoroutines,
        useCrypto: options.useCrypto,
        useGenerics: options.useGenerics,
        useContext: options.useContext,
        useChannels: options.useChannels
      });

      const goAst = transformer.transform(jsAst);

      // Step 2: Emit Go code from Go AST
      const emitter = new GoEmitter({
        indent: options.indent,
        newline: options.lineEnding,
        addComments: options.addComments
      });

      const code = emitter.emit(goAst);

      // Step 3: Collect dependencies
      const dependencies = this._collectDependencies(jsAst, options);

      // Step 4: Generate warnings
      const warnings = this._generateWarnings(jsAst, options);

      return this.CreateSuccessResult(code, dependencies, warnings);

    } catch (error) {
      console.error('AST pipeline error:', error);
      // Fallback to legacy mode
      return this._generateWithDirectEmission(jsAst, options);
    }
  }

  /**
   * Generate code using legacy direct emission
   * @private
   */
  _generateWithDirectEmission(ast, options) {
    try {
      // Reset state for clean generation
      this.indentLevel = 0;
      this.imports.clear();

      // Generate Go code
      const code = this._generateNode(ast, options);

      // Add package declaration and imports
      const finalCode = this._wrapWithPackageAndImports(code, options);

      // Collect dependencies
      const dependencies = this._collectDependencies(ast, options);

      // Generate warnings if any
      const warnings = this._generateWarnings(ast, options);

      return this.CreateSuccessResult(finalCode, dependencies, warnings);

    } catch (error) {
      return this.CreateErrorResult(`Code generation failed: ${error.message}`);
    }
  }

  /**
   * Generate code for any AST node (legacy mode)
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
        return this._generateFunction(node, options);
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
        return 'this'; // Go doesn't have 'this', use receiver context
      case 'ArrayExpression':
        return this._generateArrayExpression(node, options);
      case 'ObjectExpression':
        return this._generateObjectExpression(node, options);
      case 'Property':
        return this._generateProperty(node, options);
      case 'NewExpression':
        return this._generateNewExpression(node, options);
      case 'UnaryExpression':
        return this._generateUnaryExpression(node, options);
      case 'UpdateExpression':
        return this._generateUpdateExpression(node, options);
      case 'IfStatement':
        return this._generateIfStatement(node, options);
      case 'ForStatement':
        return this._generateForStatement(node, options);
      case 'WhileStatement':
        return this._generateWhileStatement(node, options);
      case 'SwitchStatement':
        return this._generateSwitchStatement(node, options);
      case 'BreakStatement':
        return this._generateBreakStatement(node, options);
      case 'ContinueStatement':
        return this._generateContinueStatement(node, options);
      default:
        return this._generateFallbackNode(node, options);
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
   * Generate function declaration
   * @private
   */
  _generateFunction(node, options) {
    const functionName = node.id ? this._capitalizeFirst(node.id.name) : 'UnnamedFunction';
    let code = '';

    // Go doc comment
    if (options.addComments) {
      code += this._indent(`// ${functionName} performs the ${node.id ? node.id.name : 'unnamed'} operation\n`);
    }

    // Function signature
    code += this._indent(`func ${functionName}(`);

    // Parameters with Go types
    if (node.params && node.params.length > 0) {
      const params = node.params.map(param => {
        const paramName = param.name || 'param';
        return `${paramName} interface{}`; // Use interface{} for generic type
      });
      code += params.join(', ');
    }

    // Return type (infer from context or use interface{})
    code += ') interface{} {\n';

    // Function body
    this.indentLevel++;
    if (node.body) {
      const bodyCode = this._generateNode(node.body, options);
      code += bodyCode;
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
      return '';
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
        const varName = decl.id ? decl.id.name : 'variable';

        if (decl.init) {
          const initValue = this._generateNode(decl.init, options);
          // Use := for short variable declaration in Go
          return this._indent(`${varName} := ${initValue}\n`);
        } else {
          // Use var declaration with zero value
          return this._indent(`var ${varName} interface{}\n`);
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
    return expr ? this._indent(expr + '\n') : '';
  }

  /**
   * Generate return statement
   * @private
   */
  _generateReturnStatement(node, options) {
    if (node.argument) {
      const returnValue = this._generateNode(node.argument, options);
      return this._indent(`return ${returnValue}\n`);
    } else {
      return this._indent('return nil\n');
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

    // Map JavaScript operators to Go
    if (operator === '===') operator = '==';
    if (operator === '!==') operator = '!=';

    return `${left} ${operator} ${right}`;
  }

  /**
   * Generate call expression with Go patterns
   * @private
   */
  _generateCallExpression(node, options) {
    const callee = this._generateNode(node.callee, options);
    const args = node.arguments ?
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';

    // Handle OpCodes calls
    if (node.callee.type === 'MemberExpression' &&
        node.callee.object.name === 'OpCodes') {
      const methodName = node.callee.property.name;
      return this._generateOpCodesCall(methodName, args);
    }

    return `${callee}(${args})`;
  }

  /**
   * Generate member expression
   * @private
   */
  _generateMemberExpression(node, options) {
    const object = this._generateNode(node.object, options);
    const property = node.computed ?
      `[${this._generateNode(node.property, options)}]` :
      `.${this._capitalizeFirst(node.property.name || node.property)}`;

    return `${object}${property}`;
  }

  /**
   * Generate assignment expression
   * @private
   */
  _generateAssignmentExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    const operator = node.operator;
    return `${left} ${operator} ${right}`;
  }

  /**
   * Generate identifier
   * @private
   */
  _generateIdentifier(node, options) {
    return node.name;
  }

  /**
   * Generate literal
   * @private
   */
  _generateLiteral(node, options) {
    if (typeof node.value === 'string') {
      return `"${node.value.replace(/"/g, '\\"')}"`;
    } else if (node.value === null) {
      return 'nil';
    } else if (typeof node.value === 'boolean') {
      return node.value ? 'true' : 'false';
    } else {
      return String(node.value);
    }
  }

  /**
   * Generate array expression
   * @private
   */
  _generateArrayExpression(node, options) {
    if (!node.elements) {
      return '[]interface{}{}';
    }

    const elements = node.elements.map(element => {
      if (element === null) {
        return 'nil';
      }
      return this._generateNode(element, options);
    });

    return `[]interface{}{${elements.join(', ')}}`;
  }

  /**
   * Generate object expression
   * @private
   */
  _generateObjectExpression(node, options) {
    if (!node.properties || node.properties.length === 0) {
      return 'map[string]interface{}{}';
    }

    const properties = node.properties.map(prop => {
      return this._generateNode(prop, options);
    });

    return `map[string]interface{}{${properties.join(', ')}}`;
  }

  /**
   * Generate property (for object literals)
   * @private
   */
  _generateProperty(node, options) {
    const key = node.key ? this._generateNode(node.key, options) : 'unknown';
    const value = node.value ? this._generateNode(node.value, options) : 'nil';

    const quotedKey = node.key && node.key.type === 'Identifier' ? `"${key}"` : key;
    return `${quotedKey}: ${value}`;
  }

  /**
   * Generate if statement
   * @private
   */
  _generateIfStatement(node, options) {
    const test = this._generateNode(node.test, options);
    let code = this._indent(`if ${test} {\n`);

    this.indentLevel++;
    if (node.consequent) {
      const consequent = this._generateNode(node.consequent, options);
      code += consequent;
    }
    this.indentLevel--;

    code += this._indent('}\n');

    if (node.alternate) {
      if (node.alternate.type === 'IfStatement') {
        code = code.trimEnd() + ' else ';
        const elseIfCode = this._generateIfStatement(node.alternate, options);
        code += elseIfCode.replace(/^\s*/, '');
      } else {
        code = code.trimEnd() + ' else {\n';
        this.indentLevel++;
        const alternate = this._generateNode(node.alternate, options);
        code += alternate;
        this.indentLevel--;
        code += this._indent('}\n');
      }
    }

    return code;
  }

  /**
   * Generate for statement
   * @private
   */
  _generateForStatement(node, options) {
    let code = this._indent('for ');

    if (node.init) {
      const init = this._generateNode(node.init, options);
      code += init.replace(/\n/g, '').replace(/^\s+/, '');
    }
    code += '; ';

    if (node.test) {
      const test = this._generateNode(node.test, options);
      code += test;
    }
    code += '; ';

    if (node.update) {
      const update = this._generateNode(node.update, options);
      code += update;
    }

    code += ' {\n';

    this.indentLevel++;
    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body;
    }
    this.indentLevel--;

    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate while statement
   * @private
   */
  _generateWhileStatement(node, options) {
    const test = this._generateNode(node.test, options);
    let code = this._indent(`for ${test} {\n`);

    this.indentLevel++;
    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body;
    }
    this.indentLevel--;

    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate switch statement
   * @private
   */
  _generateSwitchStatement(node, options) {
    const discriminant = this._generateNode(node.discriminant, options);
    let code = this._indent(`switch ${discriminant} {\n`);

    if (node.cases) {
      node.cases.forEach(caseNode => {
        code += this._generateNode(caseNode, options);
      });
    }

    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate break statement
   * @private
   */
  _generateBreakStatement(node, options) {
    return this._indent('break\n');
  }

  /**
   * Generate continue statement
   * @private
   */
  _generateContinueStatement(node, options) {
    return this._indent('continue\n');
  }

  /**
   * Generate unary expression
   * @private
   */
  _generateUnaryExpression(node, options) {
    const argument = this._generateNode(node.argument, options);
    return `${node.operator}${argument}`;
  }

  /**
   * Generate update expression
   * @private
   */
  _generateUpdateExpression(node, options) {
    const argument = this._generateNode(node.argument, options);
    if (node.prefix) {
      return `${node.operator}${argument}`;
    } else {
      return `${argument}${node.operator}`;
    }
  }

  /**
   * Generate new expression
   * @private
   */
  _generateNewExpression(node, options) {
    const callee = this._generateNode(node.callee, options);
    const args = node.arguments ?
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';

    if (node.callee.name === 'Array') {
      return `make([]interface{}, ${args || 0})`;
    }

    return `&${callee}{${args}}`;
  }

  /**
   * Generate fallback for unsupported nodes
   * @private
   */
  _generateFallbackNode(node, options) {
    return `/* Unsupported AST node type: ${node.type} */`;
  }

  /**
   * Capitalize first letter (Go convention for exported functions)
   * @private
   */
  _capitalizeFirst(str) {
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
   * Wrap generated code with package and imports
   * @private
   */
  _wrapWithPackageAndImports(code, options) {
    let result = `package ${options.packageName}\n\n`;

    this.imports.add('fmt');

    if (this.imports.size > 0) {
      if (this.imports.size === 1) {
        result += `import "${Array.from(this.imports)[0]}"\n\n`;
      } else {
        result += 'import (\n';
        for (const imp of this.imports) {
          result += `\t"${imp}"\n`;
        }
        result += ')\n\n';
      }
    }

    result += code;
    return result;
  }

  /**
   * Generate OpCodes method call with Go crypto optimizations
   * @private
   */
  _generateOpCodesCall(methodName, args) {
    switch (methodName) {
      case 'Pack32LE':
      case 'Pack32BE':
      case 'Unpack32LE':
      case 'Unpack32BE':
        this.imports.add('encoding/binary');
        return `binary.${methodName.includes('LE') ? 'LittleEndian' : 'BigEndian'}.Uint32(${args})`;
      case 'RotL32':
      case 'RotR32':
        this.imports.add('math/bits');
        return `bits.RotateLeft32(${args})`;
      case 'Hex8ToBytes':
        this.imports.add('encoding/hex');
        return `hex.DecodeString(${args})`;
      case 'BytesToHex8':
        this.imports.add('encoding/hex');
        return `hex.EncodeToString(${args})`;
      default:
        return `opcodes.${methodName}(${args})`;
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
