/**
 * Rust Language Plugin for Multi-Language Code Generation
 * Generates Rust code from JavaScript AST
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
 * Rust Code Generator Plugin
 * Extends LanguagePlugin base class
 */
class RustPlugin extends LanguagePlugin {
  constructor() {
    super();
    
    // Required plugin metadata
    this.name = 'Rust';
    this.extension = 'rs';
    this.icon = '🦀';
    this.description = 'Rust language code generator';
    this.mimeType = 'text/x-rust';
    this.version = '1.70+';
    
    // Rust-specific options
    this.options = {
      indent: '    ', // 4 spaces (Rust convention)
      lineEnding: '\n',
      addComments: true,
      useStrictTypes: true,
      errorHandling: true,
      edition: '2021',
      useOwnership: true,
      useTraits: true,
      useGenerics: true,
      useAsyncAwait: true,
      useZeroCopy: true,
      useSIMD: false,
      noStd: false // For embedded/no_std environments
    };
    
    // Internal state
    this.indentLevel = 0;
    this.uses = new Set();
  }

  /**
   * Generate Rust code from Abstract Syntax Tree
   * @param {Object} ast - Parsed/Modified AST representation
   * @param {Object} options - Generation options
   * @returns {CodeGenerationResult}
   */
  GenerateFromAST(ast, options = {}) {
    try {
      // Reset state for clean generation
      this.indentLevel = 0;
      this.uses.clear();
      
      // Merge options
      const mergedOptions = { ...this.options, ...options };
      
      // Validate AST
      if (!ast || typeof ast !== 'object') {
        return this.CreateErrorResult('Invalid AST: must be an object');
      }
      
      // Generate Rust code
      const code = this._generateNode(ast, mergedOptions);
      
      // Add use statements and module structure
      const finalCode = this._wrapWithModuleStructure(code, mergedOptions);
      
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
        return this._generateFunction(node, options);
      case 'ClassDeclaration':
        return this._generateStruct(node, options);
      case 'MethodDefinition':
        return this._generateMethod(node, options);
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
        return 'self';
      case 'Super':
        return 'Self'; // Rust uses Self for type reference
      case 'ArrayExpression':
        return this._generateArrayExpression(node, options);
      case 'ObjectExpression':
        return this._generateObjectExpression(node, options);
      case 'Property':
        return this._generateProperty(node, options);
      case 'FunctionExpression':
        return this._generateFunctionExpression(node, options);
      case 'ArrowFunctionExpression':
        return this._generateArrowFunctionExpression(node, options);
      case 'NewExpression':
        return this._generateNewExpression(node, options);
      case 'UnaryExpression':
        return this._generateUnaryExpression(node, options);
      case 'UpdateExpression':
        return this._generateUpdateExpression(node, options);
      case 'LogicalExpression':
        return this._generateLogicalExpression(node, options);
      case 'ConditionalExpression':
        return this._generateConditionalExpression(node, options);
      case 'SequenceExpression':
        return this._generateSequenceExpression(node, options);
      case 'TemplateLiteral':
        return this._generateTemplateLiteral(node, options);
      case 'TaggedTemplateExpression':
        return this._generateTaggedTemplateExpression(node, options);
      case 'RestElement':
        return this._generateRestElement(node, options);
      case 'SpreadElement':
        return this._generateSpreadElement(node, options);
      case 'AssignmentPattern':
        return this._generateAssignmentPattern(node, options);
      case 'ObjectPattern':
        return this._generateObjectPattern(node, options);
      case 'ArrayPattern':
        return this._generateArrayPattern(node, options);
      case 'VariableDeclarator':
        return this._generateVariableDeclarator(node, options);
      case 'IfStatement':
        return this._generateIfStatement(node, options);
      case 'WhileStatement':
        return this._generateWhileStatement(node, options);
      case 'ForStatement':
        return this._generateForStatement(node, options);
      case 'ForInStatement':
        return this._generateForInStatement(node, options);
      case 'ForOfStatement':
        return this._generateForOfStatement(node, options);
      case 'DoWhileStatement':
        return this._generateDoWhileStatement(node, options);
      case 'SwitchStatement':
        return this._generateSwitchStatement(node, options);
      case 'SwitchCase':
        return this._generateSwitchCase(node, options);
      case 'BreakStatement':
        return this._generateBreakStatement(node, options);
      case 'ContinueStatement':
        return this._generateContinueStatement(node, options);
      case 'TryStatement':
        return this._generateTryStatement(node, options);
      case 'CatchClause':
        return this._generateCatchClause(node, options);
      case 'ThrowStatement':
        return this._generateThrowStatement(node, options);
      case 'EmptyStatement':
        return this._generateEmptyStatement(node, options);
      case 'DebuggerStatement':
        return this._generateDebuggerStatement(node, options);
      case 'WithStatement':
        return this._generateWithStatement(node, options);
      case 'LabeledStatement':
        return this._generateLabeledStatement(node, options);
      case 'MetaProperty':
        return this._generateMetaProperty(node, options);
      case 'AwaitExpression':
        return this._generateAwaitExpression(node, options);
      case 'YieldExpression':
        return this._generateYieldExpression(node, options);
      case 'ImportDeclaration':
        return this._generateImportDeclaration(node, options);
      case 'ExportDefaultDeclaration':
        return this._generateExportDeclaration(node, options);
      case 'ExportNamedDeclaration':
        return this._generateExportDeclaration(node, options);
      case 'ClassExpression':
        return this._generateClassExpression(node, options);
      case 'PropertyDefinition':
        return this._generatePropertyDefinition(node, options);
      case 'PrivateIdentifier':
        return this._generatePrivateIdentifier(node, options);
      case 'StaticBlock':
        return this._generateStaticBlock(node, options);
      case 'ChainExpression':
        return this._generateChainExpression(node, options);
      case 'ImportExpression':
        return this._generateImportExpression(node, options);
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
    const functionName = node.id ? this._toSnakeCase(node.id.name) : 'unnamed_function';
    let code = '';
    
    // Rust doc comment
    if (options.addComments) {
      code += this._indent('/// ' + functionName + ' function\n');
      code += this._indent('/// Performs the ' + (node.id ? node.id.name : 'unnamed') + ' operation\n');
      if (node.params && node.params.length > 0) {
        node.params.forEach(param => {
          const paramName = param.name || 'param';
          code += this._indent('/// * `' + paramName + '` - input parameter\n');
        });
      }
      code += this._indent('/// \n');
      code += this._indent('/// # Returns\n');
      code += this._indent('/// \n');
      code += this._indent('/// Returns the result of the operation\n');
    }
    
    // Function signature
    code += this._indent('fn ' + functionName + '(');
    
    // Parameters with Rust types
    if (node.params && node.params.length > 0) {
      const params = node.params.map(param => {
        const paramName = param.name || 'param';
        return paramName + ': i32'; // Default to i32, could be enhanced with type inference
      });
      code += params.join(', ');
    }
    
    // Return type
    code += ') -> i32 {\n';
    
    // Function body
    this.indentLevel++;
    if (node.body) {
      const bodyCode = this._generateNode(node.body, options);
      // Empty body is valid in Rust (returns unit type ())
      code += bodyCode;
    } else {
      // No body - empty is valid
      code += '';
    }
    this.indentLevel--;

    code += this._indent('}\n');
    
    return code;
  }

  /**
   * Generate struct (equivalent to class)
   * @private
   */
  _generateStruct(node, options) {
    const structName = node.id ? this._toPascalCase(node.id.name) : 'UnnamedStruct';
    let code = '';
    
    // Struct doc comment
    if (options.addComments) {
      code += this._indent('/// ' + structName + ' struct\n');
      code += this._indent('/// Represents a ' + (node.id ? node.id.name : 'unnamed') + ' entity\n');
    }
    
    // Struct declaration
    code += this._indent('#[derive(Debug, Clone)]\n');
    code += this._indent('pub struct ' + structName + ' {\n');
    
    // Struct fields (would need to be inferred from class body)
    this.indentLevel++;
    code += this._indent('// Fields would be defined here\n');
    this.indentLevel--;
    
    code += this._indent('}\n\n');
    
    // Implementation block
    code += this._indent('impl ' + structName + ' {\n');
    
    // Methods
    this.indentLevel++;
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
  _generateMethod(node, options) {
    if (!node.key || !node.value) return '';
    
    const methodName = this._toSnakeCase(node.key.name);
    const isConstructor = node.key.name === 'constructor';
    let code = '';
    
    // Method doc comment
    if (options.addComments) {
      code += this._indent('/// ' + (isConstructor ? 'Creates a new instance' : methodName + ' method') + '\n');
      if (node.value.params && node.value.params.length > 0) {
        node.value.params.forEach(param => {
          const paramName = param.name || 'param';
          code += this._indent('/// * `' + paramName + '` - input parameter\n');
        });
      }
    }
    
    // Method signature
    if (isConstructor) {
      code += this._indent('pub fn new(');
    } else {
      code += this._indent('pub fn ' + methodName + '(&self');
      if (node.value.params && node.value.params.length > 0) {
        code += ', ';
      }
    }
    
    // Parameters
    if (node.value.params && node.value.params.length > 0) {
      const params = node.value.params.map(param => {
        const paramName = param.name || 'param';
        return paramName + ': i32';
      });
      code += params.join(', ');
    }
    
    if (isConstructor) {
      code += ') -> Self {\n';
    } else {
      code += ') -> i32 {\n';
    }
    
    // Method body
    this.indentLevel++;
    if (node.value.body) {
      const bodyCode = this._generateNode(node.value.body, options);
      // Empty body: constructors need Self {}, others are valid empty
      code += bodyCode || (isConstructor ? this._indent('Self {}\n') : '');
    } else {
      if (isConstructor) {
        code += this._indent('Self {}\n');
      } else {
        // No body - empty is valid
        code += '';
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
      return this._indent('panic!("Empty block")\n');
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
        const varName = decl.id ? this._toSnakeCase(decl.id.name) : 'variable';
        
        if (decl.init) {
          const initValue = this._generateNode(decl.init, options);
          // Use let for mutable variables
          const keyword = node.kind === 'const' ? 'let' : 'let mut';
          return this._indent(keyword + ' ' + varName + ' = ' + initValue + ';\n');
        } else {
          return this._indent('let ' + varName + ': i32;\n');
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
      return this._indent(returnValue + '\n'); // Rust uses implicit returns
    } else {
      return this._indent('()\n'); // Unit type
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
    
    // Rust operators
    switch (operator) {
      case '===':
      case '==':
        operator = '==';
        break;
      case '!==':
      case '!=':
        operator = '!=';
        break;
      case '&&':
        operator = '&&';
        break;
      case '||':
        operator = '||';
        break;
    }
    
    return left + ' ' + operator + ' ' + right;
  }

  /**
   * Generate call expression with Rust patterns
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

    // Handle special JavaScript methods
    if (node.callee.type === 'MemberExpression') {
      const object = this._generateNode(node.callee.object, options);
      const property = node.callee.property.name;

      switch (property) {
        case 'push':
          return `${object}.push(${args})`;
        case 'pop':
          return `${object}.pop().unwrap_or_default()`;
        case 'length':
          return `${object}.len()`;
        case 'charAt':
          return `${object}.chars().nth(${args}).unwrap_or('\\0')`;
        case 'charCodeAt':
          return `${object}.chars().nth(${args}).unwrap_or('\\0') as u8`;
        case 'substring':
        case 'substr':
          return `&${object}[${args}]`;
        case 'indexOf':
          return `${object}.find(${args}).unwrap_or(usize::MAX)`;
        case 'toUpperCase':
          return `${object}.to_uppercase()`;
        case 'toLowerCase':
          return `${object}.to_lowercase()`;
        case 'split':
          return `${object}.split(${args}).collect::<Vec<_>>()`;
        case 'join':
          return `${object}.join(${args})`;
        case 'slice':
          return `&${object}[${args}]`;
        case 'toString':
          return `${object}.to_string()`;
        case 'map':
          return `${object}.iter().map(|x| ${args}).collect::<Vec<_>>()`;
        case 'filter':
          return `${object}.iter().filter(|&x| ${args}).cloned().collect::<Vec<_>>()`;
        case 'reduce':
          return `${object}.iter().fold(${args})`;
        case 'forEach':
          return `${object}.iter().for_each(|x| ${args})`;
        default:
          return `${callee}(${args})`;
      }
    }

    // Handle constructor calls
    if (node.callee.type === 'Identifier') {
      switch (node.callee.name) {
        case 'Array':
          return `vec![${args}]`;
        case 'Object':
          this.uses.add('use std::collections::HashMap');
          return 'HashMap::new()';
        case 'String':
          return `String::from(${args})`;
        case 'Number':
          return `${args} as f64`;
        case 'BigInt':
          this.uses.add('use num_bigint::BigInt');
          return `BigInt::from(${args})`;
      }
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
      '[' + this._generateNode(node.property, options) + ']' : 
      '.' + this._toSnakeCase(node.property.name || node.property);
    
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
    return this._toSnakeCase(node.name);
  }

  /**
   * Generate literal
   * @private
   */
  _generateLiteral(node, options) {
    if (typeof node.value === 'string') {
      return '"' + node.value.replace(/"/g, '\\"') + '"';
    } else if (node.value === null) {
      return 'None'; // Option<T>::None
    } else if (typeof node.value === 'boolean') {
      return node.value ? 'true' : 'false';
    } else {
      return String(node.value);
    }
  }

  /**
   * Convert to snake_case (Rust convention)
   * @private
   */
  _toSnakeCase(str) {
    if (!str) return str;
    return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  }

  /**
   * Convert to PascalCase (Rust struct/enum naming)
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
   * Wrap generated code with module structure
   * @private
   */
  _wrapWithModuleStructure(code, options) {
    let result = '';
    
    // File header comment
    if (options.addComments) {
      result += '//! Generated Rust code\n';
      result += '//! This file was automatically generated from JavaScript AST\n\n';
    }
    
    // Use statements
    if (this.uses.size > 0) {
      for (const use of this.uses) {
        result += 'use ' + use + ';\n';
      }
      result += '\n';
    }
    
    return result + code;
  }

  /**
   * Collect required dependencies
   * @private
   */
  _collectDependencies(ast, options) {
    const dependencies = [];
    
    // Standard Rust crates that might be needed
    if (options.errorHandling) {
      dependencies.push('std::error::Error');
    }
    
    return dependencies;
  }

  /**
   * Generate warnings about potential issues
   * @private
   */
  _generateWarnings(ast, options) {
    const warnings = [];

    // Rust-specific warnings
    warnings.push('Consider using specific types instead of i32 for better type safety');
    warnings.push('Add proper error handling with Result<T, E> types');
    warnings.push('Consider using references (&T) to avoid unnecessary moves');
    warnings.push('Run `cargo clippy` to check for additional Rust-specific issues');

    return warnings;
  }

  /**
   * Generate OpCodes method call with Rust zero-copy optimizations
   * @private
   */
  _generateOpCodesCall(methodName, args) {
    // Map OpCodes methods to Rust equivalents with zero-copy patterns
    switch (methodName) {
      case 'Pack32LE':
        return `u32::to_le_bytes(${args})`;
      case 'Pack32BE':
        return `u32::to_be_bytes(${args})`;
      case 'Unpack32LE':
        return `u32::from_le_bytes(${args})`;
      case 'Unpack32BE':
        return `u32::from_be_bytes(${args})`;
      case 'RotL32':
        return `(${args}).rotate_left(shift)`;
      case 'RotR32':
        return `(${args}).rotate_right(shift)`;
      case 'XorArrays':
        return `xor_arrays(&mut ${args})`; // Custom zero-copy function
      case 'ClearArray':
        return `${args}.fill(0)`;
      case 'Hex8ToBytes':
        this.uses.add('use hex');
        return `hex::decode(${args}).unwrap()`;
      case 'BytesToHex8':
        this.uses.add('use hex');
        return `hex::encode(${args})`;
      case 'AnsiToBytes':
        return `${args}.as_bytes().to_vec()`;
      default:
        return `opcodes::${methodName}(${args})`;
    }
  }

  /**
   * Infer Rust type from JavaScript AST value with crypto context
   * @private
   */
  _inferRustType(node, context = {}) {
    if (!node) return '()';

    switch (node.type) {
      case 'Literal':
        if (typeof node.value === 'string') return '&str';
        if (typeof node.value === 'number') {
          if (Number.isInteger(node.value)) {
            return node.value >= 0 && node.value <= 255 ? 'u8' :
                   node.value >= 0 && node.value <= 65535 ? 'u16' :
                   node.value >= 0 ? 'u32' : 'i32';
          }
          return 'f64';
        }
        if (typeof node.value === 'boolean') return 'bool';
        if (node.value === null) return 'Option<()>';
        break;
      case 'ArrayExpression':
        if (node.elements && node.elements.length > 0) {
          const firstElement = node.elements.find(el => el !== null);
          if (firstElement && this._isLikelyByteValue(firstElement)) {
            return `[u8; ${node.elements.length}]`;
          }
          const elementType = this._inferRustType(firstElement, context);
          return context.useZeroCopy ? `&[${elementType}]` : `Vec<${elementType}>`;
        }
        return context.isCryptographic ? '&[u8]' : 'Vec<i32>';
      case 'ObjectExpression':
        this.uses.add('use std::collections::HashMap');
        return context.isCryptographic ? 'HashMap<&str, u32>' : 'HashMap<String, i32>';
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        return 'impl Fn() -> ()';
    }

    // Crypto-specific type inference with ownership patterns
    if (context.isCryptographic) {
      if (context.isKey) return context.useZeroCopy ? '&[u8]' : 'Vec<u8>';
      if (context.isIV) return '[u8; 16]';
      if (context.isState) return '[u32; 16]';
      return 'u32';
    }

    return 'i32';
  }

  /**
   * Check if a value is likely a byte value for crypto contexts
   * @private
   */
  _isLikelyByteValue(node) {
    if (node.type === 'Literal' && typeof node.value === 'number') {
      return node.value >= 0 && node.value <= 255;
    }
    return false;
  }

  /**
   * Generate Rust traits for crypto operations
   * @private
   */
  _generateCryptoTraits(options) {
    let traits = '';

    // Crypto key trait
    traits += '/// Trait for cryptographic keys\n';
    traits += 'trait CryptoKey {\n';
    traits += '    type Output;\n';
    traits += '    \n';
    traits += '    fn as_bytes(&self) -> &[u8];\n';
    traits += '    fn key_size() -> usize;\n';
    traits += '    fn from_bytes(bytes: &[u8]) -> Result<Self, CryptoError>\n';
    traits += '    where\n';
    traits += '        Self: Sized;\n';
    traits += '}\n\n';

    // Block cipher trait
    traits += '/// Trait for block ciphers with const generics\n';
    traits += 'trait BlockCipher<const BLOCK_SIZE: usize, const KEY_SIZE: usize> {\n';
    traits += '    type Key: CryptoKey;\n';
    traits += '    type Block = [u8; BLOCK_SIZE];\n';
    traits += '    \n';
    traits += '    fn encrypt_block(&self, block: &mut Self::Block);\n';
    traits += '    fn decrypt_block(&self, block: &mut Self::Block);\n';
    traits += '    \n';
    traits += '    fn encrypt_blocks(&self, blocks: &mut [Self::Block]) {\n';
    traits += '        for block in blocks {\n';
    traits += '            self.encrypt_block(block);\n';
    traits += '        }\n';
    traits += '    }\n';
    traits += '}\n\n';

    // Hash function trait
    traits += '/// Trait for hash functions\n';
    traits += 'trait HashFunction<const DIGEST_SIZE: usize> {\n';
    traits += '    type Digest = [u8; DIGEST_SIZE];\n';
    traits += '    \n';
    traits += '    fn new() -> Self;\n';
    traits += '    fn update(&mut self, data: &[u8]);\n';
    traits += '    fn finalize(self) -> Self::Digest;\n';
    traits += '    \n';
    traits += '    fn hash(data: &[u8]) -> Self::Digest\n';
    traits += '    where\n';
    traits += '        Self: Default,\n';
    traits += '    {\n';
    traits += '        let mut hasher = Self::default();\n';
    traits += '        hasher.update(data);\n';
    traits += '        hasher.finalize()\n';
    traits += '    }\n';
    traits += '}\n\n';

    return traits;
  }

  /**
   * Generate zero-copy crypto utilities
   * @private
   */
  _generateZeroCopyUtilities(options) {
    let utilities = '';

    // Zero-copy hex conversion
    utilities += '/// Zero-copy hex encoding\n';
    utilities += 'fn encode_hex_into(src: &[u8], dst: &mut [u8]) {\n';
    utilities += '    const HEX_CHARS: &[u8] = b"0123456789abcdef";\n';
    utilities += '    for (i, &byte) in src.iter().enumerate() {\n';
    utilities += '        dst[i * 2] = HEX_CHARS[(byte >> 4) as usize];\n';
    utilities += '        dst[i * 2 + 1] = HEX_CHARS[(byte & 0xf) as usize];\n';
    utilities += '    }\n';
    utilities += '}\n\n';

    // Const-time operations
    utilities += '/// Constant-time equality check\n';
    utilities += '#[inline]\n';
    utilities += 'fn ct_eq(a: &[u8], b: &[u8]) -> bool {\n';
    utilities += '    if a.len() != b.len() {\n';
    utilities += '        return false;\n';
    utilities += '    }\n';
    utilities += '    let mut result = 0u8;\n';
    utilities += '    for (x, y) in a.iter().zip(b.iter()) {\n';
    utilities += '        result |= x ^ y;\n';
    utilities += '    }\n';
    utilities += '    result == 0\n';
    utilities += '}\n\n';

    // Zero-copy XOR
    utilities += '/// Zero-copy XOR operation\n';
    utilities += 'fn xor_arrays(dst: &mut [u8], src: &[u8]) {\n';
    utilities += '    for (d, s) in dst.iter_mut().zip(src.iter()) {\n';
    utilities += '        *d ^= s;\n';
    utilities += '    }\n';
    utilities += '}\n\n';

    // SIMD operations if enabled
    if (options.useSIMD) {
      this.uses.add('use std::arch::x86_64::*');
      utilities += '/// SIMD-optimized XOR operation\n';
      utilities += '#[cfg(target_arch = "x86_64")]\n';
      utilities += '#[target_feature(enable = "sse2")]\n';
      utilities += 'unsafe fn xor_blocks_simd(dst: &mut [u8], src: &[u8]) {\n';
      utilities += '    assert_eq!(dst.len(), src.len());\n';
      utilities += '    assert_eq!(dst.len() % 16, 0);\n';
      utilities += '    \n';
      utilities += '    for i in (0..dst.len()).step_by(16) {\n';
      utilities += '        let a = _mm_loadu_si128(dst.as_ptr().add(i) as *const __m128i);\n';
      utilities += '        let b = _mm_loadu_si128(src.as_ptr().add(i) as *const __m128i);\n';
      utilities += '        let result = _mm_xor_si128(a, b);\n';
      utilities += '        _mm_storeu_si128(dst.as_mut_ptr().add(i) as *mut __m128i, result);\n';
      utilities += '    }\n';
      utilities += '}\n\n';
    }

    return utilities;
  }

  /**
   * Generate ownership patterns for crypto contexts
   * @private
   */
  _generateOwnershipPattern(varName, type, context = {}) {
    // Determine ownership pattern based on context
    if (context.needsMutableRef) {
      return `&mut ${type}`;
    }

    if (context.needsRef || context.useZeroCopy) {
      return `&${type}`;
    }

    if (context.needsBox) {
      this.uses.add('use std::boxed::Box');
      return `Box<${type}>`;
    }

    if (context.needsRc) {
      this.uses.add('use std::rc::Rc');
      return `Rc<${type}>`;
    }

    if (context.needsArc) {
      this.uses.add('use std::sync::Arc');
      return `Arc<${type}>`;
    }

    return type; // Owned value
  }

  /**
   * Generate missing AST node types for modern Rust
   * @private
   */
  _generateArrayExpression(node, options) {
    if (!node.elements || node.elements.length === 0) {
      return 'vec![]';
    }

    // Determine array type based on elements
    const firstElement = node.elements.find(el => el !== null);
    const elementType = this._inferRustType(firstElement, { isCryptographic: true });

    const elements = node.elements
      .map(element => element ? this._generateNode(element, options) : '0')
      .join(', ');

    if (this._isLikelyByteValue(firstElement) || elementType.includes('u8')) {
      return `[${elements}]`; // Array literal for known size
    }

    return `vec![${elements}]`;
  }

  _generateObjectExpression(node, options) {
    this.uses.add('use std::collections::HashMap');

    if (!node.properties || node.properties.length === 0) {
      return 'HashMap::new()';
    }

    let code = 'HashMap::from([\n';
    this.indentLevel++;

    const properties = node.properties
      .map(prop => {
        const key = this._generateNode(prop.key, options);
        const value = this._generateNode(prop.value, options);
        return this._indent(`(${key}, ${value})`);
      })
      .join(',\n');

    code += properties;
    this.indentLevel--;
    code += '\n' + this._indent('])');

    return code;
  }

  _generateProperty(node, options) {
    const key = this._generateNode(node.key, options);
    const value = this._generateNode(node.value, options);
    return `${key}: ${value}`;
  }

  _generateFunctionExpression(node, options) {
    let params = '';
    if (node.params && node.params.length > 0) {
      params = node.params.map(param => {
        const paramName = param.name || 'param';
        const paramType = this._inferRustType(param, { isCryptographic: true });
        return `${paramName}: ${paramType}`;
      }).join(', ');
    }

    const body = node.body ? this._generateNode(node.body, options) : '()';
    return `|${params}| ${body}`;
  }

  _generateArrowFunctionExpression(node, options) {
    return this._generateFunctionExpression(node, options);
  }

  _generateNewExpression(node, options) {
    const callee = this._generateNode(node.callee, options);
    const args = node.arguments ?
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';

    // Handle smart pointer patterns
    if (options.useOwnership) {
      this.uses.add('use std::boxed::Box');
      return `Box::new(${callee}::new(${args}))`;
    }

    return `${callee}::new(${args})`;
  }

  _generateUnaryExpression(node, options) {
    const argument = this._generateNode(node.argument, options);
    const operator = node.operator;

    switch (operator) {
      case 'typeof':
        return `std::any::type_name_of_val(&${argument})`;
      case 'delete':
        return `drop(${argument})`; // Rust automatically drops
      case 'void':
        return `{ ${argument}; () }`;
      case '!':
        return `!${argument}`;
      case '~':
        return `!${argument}`; // Bitwise NOT
      case '+':
        return `+${argument}`;
      case '-':
        return `-${argument}`;
      default:
        return `${operator}${argument}`;
    }
  }

  _generateUpdateExpression(node, options) {
    const argument = this._generateNode(node.argument, options);
    const operator = node.operator;

    if (node.prefix) {
      if (operator === '++') {
        return `{ ${argument} += 1; ${argument} }`;
      } else if (operator === '--') {
        return `{ ${argument} -= 1; ${argument} }`;
      }
    } else {
      if (operator === '++') {
        return `{ let tmp = ${argument}; ${argument} += 1; tmp }`;
      } else if (operator === '--') {
        return `{ let tmp = ${argument}; ${argument} -= 1; tmp }`;
      }
    }

    return `${argument}${operator}`;
  }

  _generateLogicalExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    let operator = node.operator;

    switch (operator) {
      case '||':
        operator = '||';
        break;
      case '&&':
        operator = '&&';
        break;
      case '??':
        // Rust equivalent using Option
        return `${left}.or(Some(${right})).unwrap()`;
    }

    return `${left} ${operator} ${right}`;
  }

  _generateConditionalExpression(node, options) {
    const test = this._generateNode(node.test, options);
    const consequent = this._generateNode(node.consequent, options);
    const alternate = this._generateNode(node.alternate, options);

    return `if ${test} { ${consequent} } else { ${alternate} }`;
  }

  _generateSequenceExpression(node, options) {
    const expressions = node.expressions
      .map(expr => this._generateNode(expr, options))
      .join('; ');
    return `{ ${expressions} }`;
  }

  _generateTemplateLiteral(node, options) {
    let result = 'format!(';
    let formatStr = '';
    let args = [];

    for (let i = 0; i < node.quasis.length; i++) {
      const quasi = node.quasis[i];
      if (quasi.value && quasi.value.cooked) {
        formatStr += quasi.value.cooked;
      }

      if (i < node.expressions.length) {
        formatStr += '{}';
        const expression = this._generateNode(node.expressions[i], options);
        args.push(expression);
      }
    }

    result += `"${formatStr}"`;
    if (args.length > 0) {
      result += ', ' + args.join(', ');
    }
    result += ')';

    return result;
  }

  _generateTaggedTemplateExpression(node, options) {
    const tag = this._generateNode(node.tag, options);
    const template = this._generateTemplateLiteral(node.quasi, options);
    return `${tag}!(${template})`; // Macro call in Rust
  }

  _generateIfStatement(node, options) {
    let code = '';
    const test = this._generateNode(node.test, options);

    code += this._indent(`if ${test} {\n`);
    this.indentLevel++;

    if (node.consequent) {
      const consequent = this._generateNode(node.consequent, options);
      code += consequent || this._indent('// Empty if body\n');
    }

    this.indentLevel--;
    code += this._indent('}\n');

    if (node.alternate) {
      if (node.alternate.type === 'IfStatement') {
        code += this._indent('else ');
        code += this._generateIfStatement(node.alternate, options).replace(/^\s+/, '');
      } else {
        code += this._indent('else {\n');
        this.indentLevel++;
        const alternate = this._generateNode(node.alternate, options);
        code += alternate || this._indent('// Empty else body\n');
        this.indentLevel--;
        code += this._indent('}\n');
      }
    }

    return code;
  }

  _generateWhileStatement(node, options) {
    let code = '';
    const test = this._generateNode(node.test, options);

    code += this._indent(`while ${test} {\n`);
    this.indentLevel++;

    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body || this._indent('// Empty while body\n');
    }

    this.indentLevel--;
    code += this._indent('}\n');
    return code;
  }

  _generateForStatement(node, options) {
    // Rust doesn't have C-style for loops, convert to while
    let code = '';

    if (node.init) {
      const init = this._generateNode(node.init, options);
      code += init;
    }

    const test = node.test ? this._generateNode(node.test, options) : 'true';
    code += this._indent(`while ${test} {\n`);
    this.indentLevel++;

    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body || this._indent('// Empty for body\n');
    }

    if (node.update) {
      const update = this._generateNode(node.update, options);
      code += this._indent(`${update};\n`);
    }

    this.indentLevel--;
    code += this._indent('}\n');
    return code;
  }

  _generateForInStatement(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);

    let code = this._indent(`for ${left.replace(/^(let|const)\s+/, '')} in ${right} {\n`);
    this.indentLevel++;

    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body || this._indent('// Empty for-in body\n');
    }

    this.indentLevel--;
    code += this._indent('}\n');
    return code;
  }

  _generateForOfStatement(node, options) {
    return this._generateForInStatement(node, options); // Same in Rust
  }

  _generateDoWhileStatement(node, options) {
    // Rust doesn't have do-while, use loop with break
    let code = this._indent('loop {\n');
    this.indentLevel++;

    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body || this._indent('// Empty do-while body\n');
    }

    const test = this._generateNode(node.test, options);
    code += this._indent(`if !(${test}) { break; }\n`);

    this.indentLevel--;
    code += this._indent('}\n');
    return code;
  }

  _generateSwitchStatement(node, options) {
    let code = '';
    const discriminant = this._generateNode(node.discriminant, options);

    code += this._indent(`match ${discriminant} {\n`);
    this.indentLevel++;

    if (node.cases) {
      for (const caseNode of node.cases) {
        code += this._generateSwitchCase(caseNode, options);
      }
    }

    this.indentLevel--;
    code += this._indent('}\n');
    return code;
  }

  _generateSwitchCase(node, options) {
    let code = '';

    if (node.test) {
      const test = this._generateNode(node.test, options);
      code += this._indent(`${test} => {\n`);
    } else {
      code += this._indent('_ => {\n'); // Default case
    }

    this.indentLevel++;
    if (node.consequent) {
      for (const stmt of node.consequent) {
        if (stmt.type !== 'BreakStatement') {
          code += this._generateNode(stmt, options);
        }
      }
    }
    this.indentLevel--;
    code += this._indent('}\n');

    return code;
  }

  _generateBreakStatement(node, options) {
    return this._indent('break;\n');
  }

  _generateContinueStatement(node, options) {
    return this._indent('continue;\n');
  }

  _generateTryStatement(node, options) {
    // Rust uses Result types instead of try-catch
    let code = this._indent('// Rust uses Result<T, E> instead of try-catch\n');

    if (node.block) {
      const block = this._generateNode(node.block, options);
      code += block;
    }

    return code;
  }

  _generateCatchClause(node, options) {
    return this._indent('// Catch clause converted to Result error handling\n');
  }

  _generateThrowStatement(node, options) {
    if (node.argument) {
      const argument = this._generateNode(node.argument, options);
      return this._indent(`return Err(${argument});\n`);
    } else {
      return this._indent('return Err("Error".to_string());\n');
    }
  }

  _generateEmptyStatement(node, options) {
    return this._indent(';\n');
  }

  _generateDebuggerStatement(node, options) {
    return this._indent('// Debugger statement\n');
  }

  _generateWithStatement(node, options) {
    return this._indent('// With statement not supported in Rust\n');
  }

  _generateLabeledStatement(node, options) {
    const label = this._generateNode(node.label, options);
    const body = this._generateNode(node.body, options);
    return `'${label}: ${body}`; // Rust lifetime syntax
  }

  _generateMetaProperty(node, options) {
    return `// MetaProperty: ${node.meta?.name || 'unknown'}.${node.property?.name || 'unknown'}`;
  }

  _generateAwaitExpression(node, options) {
    if (options.useAsyncAwait) {
      const argument = this._generateNode(node.argument, options);
      return `${argument}.await`;
    }
    const argument = this._generateNode(node.argument, options);
    return `${argument}.wait()`; // Assume blocking wait
  }

  _generateYieldExpression(node, options) {
    const argument = node.argument ? this._generateNode(node.argument, options) : '()';
    return `yield ${argument}`; // Generator syntax
  }

  _generateImportDeclaration(node, options) {
    const source = this._generateNode(node.source, options);
    const cleanSource = source.replace(/["']/g, '');

    if (node.specifiers && node.specifiers.length > 0) {
      const imports = node.specifiers.map(spec => {
        if (spec.type === 'ImportDefaultSpecifier') {
          return spec.local.name;
        }
        return spec.imported?.name || spec.local.name;
      }).join(', ');
      this.uses.add(`use ${cleanSource}::{${imports}}`);
    } else {
      this.uses.add(`use ${cleanSource}`);
    }

    return this._indent(`// use ${cleanSource};\n`);
  }

  _generateExportDeclaration(node, options) {
    // Rust uses pub for exports
    const declaration = this._generateNode(node.declaration, options);
    return declaration.replace(/^(\s*)(fn|struct|enum|trait)/, '$1pub $2');
  }

  _generateClassExpression(node, options) {
    return this._generateStruct(node, options);
  }

  _generatePropertyDefinition(node, options) {
    const key = this._generateNode(node.key, options);
    const value = node.value ? this._generateNode(node.value, options) : 'Default::default()';
    const type = this._inferRustType(node.value, { isCryptographic: true });
    const visibility = 'pub'; // Public by default
    return this._indent(`${visibility} ${key}: ${type},\n`);
  }

  _generatePrivateIdentifier(node, options) {
    return `_${node.name}`; // Use underscore prefix for private
  }

  _generateStaticBlock(node, options) {
    return this._indent('// Static block not directly supported in Rust\n');
  }

  _generateChainExpression(node, options) {
    // Rust uses ? operator for Option/Result chaining
    const expr = this._generateNode(node.expression, options);
    return `${expr}?`;
  }

  _generateImportExpression(node, options) {
    const source = this._generateNode(node.source, options);
    return `/* Dynamic import not supported: ${source} */`;
  }

  _generateRestElement(node, options) {
    const argument = this._generateNode(node.argument, options);
    return `..${argument}`; // Rust range syntax
  }

  _generateSpreadElement(node, options) {
    const argument = this._generateNode(node.argument, options);
    return `..${argument}`;
  }

  _generateAssignmentPattern(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    return `${left} = ${right}`;
  }

  _generateObjectPattern(node, options) {
    const properties = node.properties
      .map(prop => this._generateNode(prop, options))
      .join(', ');
    return `{ ${properties} }`; // Struct destructuring
  }

  _generateArrayPattern(node, options) {
    const elements = node.elements
      .map(element => element ? this._generateNode(element, options) : '_')
      .join(', ');
    return `[${elements}]`;
  }

  _generateVariableDeclarator(node, options) {
    const id = this._generateNode(node.id, options);
    if (node.init) {
      const init = this._generateNode(node.init, options);
      const type = this._inferRustType(node.init, { isCryptographic: true });
      return `${id}: ${type} = ${init}`;
    }
    return id;
  }

  _generateFallbackNode(node, options) {
    // Enhanced fallback for unknown node types
    if (node.type && node.type.startsWith('TS')) {
      return `/* TypeScript node: ${node.type} */`;
    }

    // Try to handle common patterns
    if (node.operator && node.left && node.right) {
      const left = this._generateNode(node.left, options);
      const right = this._generateNode(node.right, options);
      return `${left} ${node.operator} ${right}`;
    }

    // Generate minimal valid Rust code with warning
    return `{\n${this._indent('// WARNING: Unhandled AST node type: ' + node.type + '\n')}${this._indent('panic!("Not implemented: ' + node.type + '");\n')}}`;
  }

  /**
   * Check if Rust compiler is available on the system
   * @private
   */
  _isRustAvailable() {
    try {
      const { execSync } = require('child_process');
      execSync('rustc --version', { 
        stdio: 'pipe', 
        timeout: 2000,
        windowsHide: true  // Prevent Windows error dialogs
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Basic syntax validation for Rust code
   * @private
   */
  _checkBalancedSyntax(code) {
    try {
      let braces = 0;
      let parentheses = 0;
      let brackets = 0;
      let inString = false;
      let inRawString = false;
      let inLineComment = false;
      let inBlockComment = false;
      let escaped = false;
      let rawStringHashes = 0;
      
      for (let i = 0; i < code.length; i++) {
        const char = code[i];
        const nextChar = i < code.length - 1 ? code[i + 1] : '';
        
        // Handle raw strings (r#"..."# or r"...")
        if (char === 'r' && nextChar === '"' && !inString && !inLineComment && !inBlockComment) {
          inRawString = true;
          rawStringHashes = 0;
          i++; // Skip the quote
          continue;
        }
        
        if (char === 'r' && nextChar === '#' && !inString && !inLineComment && !inBlockComment) {
          // Count hashes for raw string delimiter
          let hashCount = 0;
          let j = i + 1;
          while (j < code.length && code[j] === '#') {
            hashCount++;
            j++;
          }
          if (j < code.length && code[j] === '"') {
            inRawString = true;
            rawStringHashes = hashCount;
            i = j; // Skip to the quote
            continue;
          }
        }
        
        // End raw strings
        if (inRawString && char === '"') {
          let hashCount = 0;
          let j = i + 1;
          while (j < code.length && code[j] === '#' && hashCount < rawStringHashes) {
            hashCount++;
            j++;
          }
          if (hashCount === rawStringHashes) {
            inRawString = false;
            i = j - 1; // Will be incremented by loop
            continue;
          }
        }
        
        // Handle regular strings
        if (char === '"' && !escaped && !inRawString && !inLineComment && !inBlockComment) {
          inString = !inString;
          continue;
        }
        
        // Handle comments
        if (!inString && !inRawString) {
          if (char === '/' && nextChar === '/' && !inBlockComment) {
            inLineComment = true;
            i++; // Skip next character
            continue;
          }
          if (char === '/' && nextChar === '*' && !inLineComment) {
            inBlockComment = true;
            i++; // Skip next character
            continue;
          }
          if (char === '*' && nextChar === '/' && inBlockComment) {
            inBlockComment = false;
            i++; // Skip next character
            continue;
          }
        }
        
        // Handle line endings for line comments
        if (char === '\n') {
          inLineComment = false;
        }
        
        // Track escape sequences in regular strings
        if (char === '\\' && inString && !inRawString) {
          escaped = !escaped;
          continue;
        } else {
          escaped = false;
        }
        
        // Skip if inside string or comment
        if (inString || inRawString || inLineComment || inBlockComment) {
          continue;
        }
        
        // Count brackets and braces
        switch (char) {
          case '{':
            braces++;
            break;
          case '}':
            braces--;
            if (braces < 0) return false;
            break;
          case '(':
            parentheses++;
            break;
          case ')':
            parentheses--;
            if (parentheses < 0) return false;
            break;
          case '[':
            brackets++;
            break;
          case ']':
            brackets--;
            if (brackets < 0) return false;
            break;
        }
      }
      
      return braces === 0 && parentheses === 0 && brackets === 0 && !inString && !inRawString && !inBlockComment;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate Rust code syntax using rustc compiler
   * @override
   */
  ValidateCodeSyntax(code) {
    // Check if Rust is available first
    if (!this._isRustAvailable()) {
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'Rust compiler not available - using basic validation'
      };
    }

    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');
      
      // Create temporary file
      const tempFile = path.join(__dirname, '..', '.agent.tmp', `temp_rust_${Date.now()}.rs`);
      
      // Ensure .agent.tmp directory exists
      const tempDir = path.dirname(tempFile);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Write Rust code to temp file
      fs.writeFileSync(tempFile, code);
      
      try {
        // Try to compile the Rust code as a library crate (--crate-type=lib allows incomplete code)
        execSync(`rustc --crate-type=lib "${tempFile}"`, { 
          stdio: 'pipe',
          timeout: 3000,
          windowsHide: true  // Prevent Windows error dialogs
        });
        
        // Clean up (rustc generates output files)
        fs.unlinkSync(tempFile);
        
        // Clean up any generated library files
        const libFile = tempFile.replace('.rs', '.rlib');
        if (fs.existsSync(libFile)) {
          fs.unlinkSync(libFile);
        }
        
        return {
          success: true,
          method: 'rustc',
          error: null
        };
        
      } catch (error) {
        // Clean up on error
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
        
        // Clean up any generated files
        const libFile = tempFile.replace('.rs', '.rlib');
        if (fs.existsSync(libFile)) {
          fs.unlinkSync(libFile);
        }
        
        return {
          success: false,
          method: 'rustc',
          error: error.stderr?.toString() || error.message
        };
      }
      
    } catch (error) {
      // If Rust is not available or other error, fall back to basic validation
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'Rust compiler not available - using basic validation'
      };
    }
  }

  /**
   * Get Rust compiler download information
   * @override
   */
  GetCompilerInfo() {
    return {
      name: this.name,
      compilerName: 'Rust (rustc)',
      downloadUrl: 'https://www.rust-lang.org/tools/install',
      installInstructions: [
        'Install Rust using rustup from https://rustup.rs/',
        'Windows: Download and run rustup-init.exe',
        'macOS/Linux: curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh',
        'Follow the on-screen instructions to complete installation',
        'Restart your terminal or run: source $HOME/.cargo/env',
        'Verify installation with: rustc --version',
        'Install additional tools: rustup component add clippy rustfmt'
      ].join('\n'),
      verifyCommand: 'rustc --version',
      alternativeValidation: 'Basic syntax checking (balanced brackets/braces/parentheses)',
      packageManager: 'Cargo (built-in package manager)',
      documentation: 'https://doc.rust-lang.org/'
    };
  }
}

// Register the plugin
const rustPlugin = new RustPlugin();
LanguagePlugins.Add(rustPlugin);

// Export for potential direct use
// Export for potential direct use (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = rustPlugin;
}


})(); // End of IIFE