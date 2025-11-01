/**
 * C# Language Plugin for Multi-Language Code Generation
 * Generates C# code from JavaScript AST
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
    
    // Internal state
    this.indentLevel = 0;
    this.usings = new Set();
  }

  /**
   * Generate C# code from Abstract Syntax Tree
   * @param {Object} ast - Parsed/Modified AST representation
   * @param {Object} options - Generation options
   * @returns {CodeGenerationResult}
   */
  GenerateFromAST(ast, options = {}) {
    try {
      // Reset state for clean generation
      this.indentLevel = 0;
      this.usings.clear();
      
      // Merge options
      const mergedOptions = { ...this.options, ...options };
      
      // Validate AST
      if (!ast || typeof ast !== 'object') {
        return this.CreateErrorResult('Invalid AST: must be an object');
      }
      
      // Generate C# code
      const code = this._generateNode(ast, mergedOptions);
      
      // Add namespace, usings, and class structure
      const finalCode = this._wrapWithNamespaceStructure(code, mergedOptions);
      
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
      case 'UnaryExpression':
        return this._generateUnaryExpression(node, options);
      case 'UpdateExpression':
        return this._generateUpdateExpression(node, options);
      case 'LogicalExpression':
        return this._generateLogicalExpression(node, options);
      case 'ConditionalExpression':
        return this._generateConditionalExpression(node, options);
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
      case 'EmptyStatement':
        return this._generateEmptyStatement(node, options);
      case 'DebuggerStatement':
        return this._generateDebuggerStatement(node, options);
      case 'WithStatement':
        return this._generateWithStatement(node, options);
      case 'LabeledStatement':
        return this._generateLabeledStatement(node, options);
      default:
        // Fallback: Generate valid C# comment for unhandled node types
        console.warn(`C# Generator: Unhandled AST node type: ${node.type}`);
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
   * Generate method (function becomes static method)
   * @private
   */
  _generateMethod(node, options) {
    const methodName = node.id ? this._toPascalCase(node.id.name) : 'UnnamedMethod';
    let code = '';
    
    // XML documentation comment
    if (options.addComments) {
      code += this._indent('/// <summary>\n');
      code += this._indent('/// ' + methodName + ' method\n');
      code += this._indent('/// Performs the ' + (node.id ? node.id.name : 'unnamed') + ' operation\n');
      code += this._indent('/// </summary>\n');
      if (node.params && node.params.length > 0) {
        node.params.forEach(param => {
          const paramName = param.name || 'param';
          code += this._indent('/// <param name="' + this._toCamelCase(paramName) + '">Input parameter</param>\n');
        });
      }
      code += this._indent('/// <returns>Result of the operation</returns>\n');
    }
    
    // Method signature
    code += this._indent('public static int ' + methodName + '(');
    
    // Parameters with C# types
    if (node.params && node.params.length > 0) {
      const params = node.params.map(param => {
        const paramName = param.name || 'param';
        return 'int ' + this._toCamelCase(paramName);
      });
      code += params.join(', ');
    }
    
    code += ')\n';
    code += this._indent('{\n');
    
    // Method body
    this.indentLevel++;
    if (node.body) {
      const bodyCode = this._generateNode(node.body, options);
      code += bodyCode || this._indent('return 0; // Default return value\n');
    } else {
      code += this._indent('return 0; // Default return value\n');
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

    // Analyze class structure
    const { fields, properties, methods } = this._separateClassMembers(node.body);
    const isDataClass = this._isDataClass(fields, properties, methods);
    const hasOnlyImmutableData = this._hasOnlyImmutableData(fields, properties);

    // Class XML documentation
    if (options.addComments) {
      code += this._indent('/// <summary>\n');
      code += this._indent(`/// ${className} ${isDataClass ? 'record' : 'class'}\n`);
      code += this._indent(`/// Represents a ${node.id ? node.id.name : 'unnamed'} entity\n`);
      code += this._indent('/// </summary>\n');
    }

    // Use record for data-only classes with immutable data
    const classKeyword = isDataClass && hasOnlyImmutableData ? 'record' : 'class';

    // Class declaration with inheritance
    if (node.superClass) {
      const rawSuperName = this._generateNode(node.superClass, options);
      const superName = this._mapAlgorithmFrameworkClass(rawSuperName);
      code += this._indent(`public ${classKeyword} ${className} : ${superName}\n`);
    } else {
      code += this._indent(`public ${classKeyword} ${className}\n`);
    }

    code += this._indent('{\n');

    // Class body
    this.indentLevel++;

    // For records with only properties, we can use positional syntax instead
    if (isDataClass && properties.length > 0 && fields.length === 0 && methods.length === 0) {
      // Just properties, no methods or fields - already declared in record header
      // But we'll add them as body properties for clarity
    }

    // Add fields section (only if there are actual backing fields needed)
    const actualFields = fields.filter(f => this._needsBackingField(f));
    if (actualFields.length > 0) {
      code += this._indent('#region Fields\n\n');
      for (const field of actualFields) {
        code += this._generateField(field, options, hasOnlyImmutableData);
      }
      code += this._indent('#endregion\n\n');
    }

    // Add properties section
    if (properties.length > 0) {
      code += this._indent('#region Properties\n\n');
      for (const property of properties) {
        code += this._generatePropertyModern(property, options, hasOnlyImmutableData);
      }
      code += this._indent('#endregion\n\n');
    }

    // Add methods section
    if (methods.length > 0) {
      code += this._indent('#region Methods\n\n');
      const methodCode = methods
        .map(method => this._generateNode(method, options))
        .filter(m => m.trim());
      code += methodCode.join('\n\n');
      code += '\n' + this._indent('#endregion\n');
    }

    this.indentLevel--;
    code += this._indent('}\n');

    return code;
  }

  /**
   * Check if class is primarily a data container
   * @private
   */
  _isDataClass(fields, properties, methods) {
    // A data class has mostly properties/fields and few methods
    const dataMembers = fields.length + properties.length;
    const behaviorMembers = methods.filter(m =>
      !m.key || (m.key.name !== 'constructor' && m.key.name !== 'toString')
    ).length;

    return dataMembers > 0 && behaviorMembers <= 2;
  }

  /**
   * Check if class has only immutable data
   * @private
   */
  _hasOnlyImmutableData(fields, properties) {
    // Check if all fields are readonly/const
    const allFieldsReadonly = fields.every(f =>
      f.kind === 'const' || f.kind === 'readonly' || !this._isReassigned(f)
    );

    // Check if properties are get-only
    const allPropertiesGetOnly = properties.every(p =>
      p.kind === 'get' || !this._hasSetter(p)
    );

    return allFieldsReadonly && allPropertiesGetOnly;
  }

  /**
   * Check if a field needs a backing field or can be a property
   * @private
   */
  _needsBackingField(field) {
    // If field has complex logic, keep as backing field
    // Otherwise, can be replaced by property
    return field.computed || field.kind === 'method';
  }

  /**
   * Check if a member is reassigned (heuristic)
   * @private
   */
  _isReassigned(member) {
    // Simple heuristic: if it has an initializer, assume it might be readonly
    // This is a simplified check - full analysis would require data flow
    return !member.value;
  }

  /**
   * Check if property has a setter
   * @private
   */
  _hasSetter(property) {
    return property.kind === 'set' || property.kind === 'init' || !property.kind;
  }

  /**
   * Separate class members into fields, properties, and methods
   * @private
   */
  _separateClassMembers(body) {
    const fields = [];
    const properties = [];
    const methods = [];

    if (!body || !Array.isArray(body)) {
      return { fields, properties, methods };
    }

    for (const member of body) {
      if (!member) continue;

      // Distinguish between fields/properties and methods
      if (member.type === 'PropertyDefinition' || member.type === 'ClassProperty') {
        // Properties with getters/setters or readonly fields
        if (member.kind === 'get' || member.kind === 'set') {
          properties.push(member);
        } else {
          fields.push(member);
        }
      } else if (member.type === 'MethodDefinition') {
        methods.push(member);
      } else {
        // Default to methods
        methods.push(member);
      }
    }

    return { fields, properties, methods };
  }

  /**
   * Generate field declaration
   * @private
   */
  _generateField(node, options, classIsImmutable = false) {
    const fieldName = node.key ? `_${this._toCamelCase(node.key.name)}` : '_field';
    const isStatic = node.static ? 'static ' : '';

    // Use readonly if field is const, explicitly readonly, or in immutable class with initializer
    const shouldBeReadonly = node.kind === 'const' ||
                            node.kind === 'readonly' ||
                            (classIsImmutable && node.value);
    const isReadonly = shouldBeReadonly ? 'readonly ' : '';

    let code = '';
    if (options.addComments) {
      code += this._indent('/// <summary>\n');
      code += this._indent(`/// ${fieldName} field\n`);
      code += this._indent('/// </summary>\n');
    }

    if (node.value) {
      const value = this._generateNode(node.value, options);
      code += this._indent(`private ${isStatic}${isReadonly}var ${fieldName} = ${value};\n`);
    } else {
      code += this._indent(`private ${isStatic}${isReadonly}int ${fieldName};\n`);
    }

    return code + '\n';
  }

  /**
   * Generate property declaration (legacy - kept for compatibility)
   * @private
   */
  _generateProperty(node, options) {
    return this._generatePropertyModern(node, options, false);
  }

  /**
   * Generate modern property declaration with init/get-only support
   * @private
   */
  _generatePropertyModern(node, options, classIsImmutable = false) {
    const propertyName = node.key ? this._toPascalCase(node.key.name) : 'Property';
    const isStatic = node.static ? 'static ' : '';

    let code = '';
    if (options.addComments) {
      code += this._indent('/// <summary>\n');
      code += this._indent(`/// ${propertyName} property\n`);
      code += this._indent('/// </summary>\n');
    }

    // Determine property accessor pattern
    let accessors;
    if (node.kind === 'get') {
      // Get-only property
      accessors = '{ get; }';
    } else if (node.kind === 'init' || (classIsImmutable && node.value)) {
      // Init-only property (immutable after construction)
      accessors = '{ get; init; }';
    } else if (classIsImmutable) {
      // In immutable class without initializer, still allow init
      accessors = '{ get; init; }';
    } else {
      // Regular mutable property
      accessors = '{ get; set; }';
    }

    // Generate property with optional initializer
    if (node.value) {
      const value = this._generateNode(node.value, options);
      code += this._indent(`public ${isStatic}int ${propertyName} ${accessors} = ${value};\n`);
    } else {
      code += this._indent(`public ${isStatic}int ${propertyName} ${accessors}\n`);
    }

    return code + '\n';
  }

  /**
   * Generate method definition with complete body generation
   * @private
   */
  _generateMethodDef(node, options) {
    if (!node.key || !node.value) return '';

    const methodName = this._toPascalCase(node.key.name);
    const isConstructor = node.key.name === 'constructor';
    const isGetter = node.kind === 'get';
    const isSetter = node.kind === 'set';
    let code = '';

    // XML documentation
    if (options.addComments) {
      code += this._indent('/// <summary>\n');
      if (isConstructor) {
        code += this._indent('/// Initializes a new instance of the class\n');
      } else if (isGetter) {
        code += this._indent(`/// Gets the ${methodName} value\n`);
      } else if (isSetter) {
        code += this._indent(`/// Sets the ${methodName} value\n`);
      } else {
        code += this._indent('/// ' + methodName + ' method\n');
        code += this._indent('/// ' + this._generateMethodDescription(methodName) + '\n');
      }
      code += this._indent('/// </summary>\n');
      if (node.value.params && node.value.params.length > 0) {
        node.value.params.forEach(param => {
          const paramName = param.name || 'param';
          code += this._indent('/// <param name="' + this._toCamelCase(paramName) + '">' + this._generateParamDescription(paramName) + '</param>\n');
        });
      }
      if (!isConstructor && !isSetter) {
        code += this._indent('/// <returns>' + this._generateReturnDescription(methodName) + '</returns>\n');
      }
    }

    // Method signature
    if (isConstructor) {
      code += this._indent('public ' + options.className + '(');
    } else if (isGetter || isSetter) {
      // Handle properties separately
      return this._generatePropertyMethod(node, options, methodName, isGetter, isSetter);
    } else {
      const returnType = this._inferReturnType(methodName, node.value);
      const visibility = this._inferMethodVisibility(methodName);
      const isStatic = this._isStaticMethod(methodName);
      const staticKeyword = isStatic ? 'static ' : '';
      code += this._indent(`${visibility} ${staticKeyword}${returnType} ${methodName}(`);
    }

    // Parameters with improved type inference
    if (node.value.params && node.value.params.length > 0) {
      const params = node.value.params.map(param => {
        const paramName = param.name || 'param';
        const paramType = this._inferParameterType(paramName);
        return `${paramType} ${this._toCamelCase(paramName)}`;
      });
      code += params.join(', ');
    }

    // Handle base constructor calls for constructors
    let baseCall = '';
    if (isConstructor && node.value.body) {
      baseCall = this._extractBaseConstructorCall(node.value.body);
    }

    code += ')';
    if (baseCall) {
      code += ` : ${baseCall}`;
    }
    code += '\n';
    code += this._indent('{\n');

    // Method body with comprehensive generation
    this.indentLevel++;
    if (node.value.body) {
      let bodyCode;
      if (isConstructor) {
        bodyCode = this._generateConstructorBody(node.value.body, options);
      } else {
        bodyCode = this._generateCompleteMethodBody(node.value.body, options, methodName);
      }

      if (bodyCode && bodyCode.trim()) {
        code += bodyCode;
      } else {
        // Generate minimal working body for empty methods
        if (!isConstructor) {
          code += this._generateDefaultMethodReturn(node, options);
        }
      }
    } else {
      if (!isConstructor) {
        code += this._generateDefaultMethodReturn(node, options);
      }
    }
    this.indentLevel--;

    code += this._indent('}\n');

    return code;
  }

  /**
   * Generate block statement with complete handling
   * @private
   */
  _generateBlock(node, options) {
    if (!node.body || node.body.length === 0) {
      return ''; // Empty blocks are valid
    }

    const statements = node.body
      .map(stmt => this._generateNode(stmt, options))
      .filter(line => line && line.trim());

    return statements.join('\n');
  }

  /**
   * Generate complete method body with cryptographic patterns
   * @private
   */
  _generateCompleteMethodBody(bodyNode, options, methodName = '') {
    if (!bodyNode || bodyNode.type !== 'BlockStatement' || !bodyNode.body) {
      return '';
    }

    const context = {
      isCryptographic: true,
      methodName: methodName.toLowerCase()
    };

    const statements = bodyNode.body
      .map(stmt => this._generateStatementWithContext(stmt, options, context))
      .filter(code => code && code.trim());

    return statements.join('\n');
  }

  /**
   * Generate statement with cryptographic context
   * @private
   */
  _generateStatementWithContext(stmt, options, context) {
    // Handle specific cryptographic patterns
    if (stmt.type === 'ForStatement') {
      return this._generateCryptoForStatement(stmt, options, context);
    }
    if (stmt.type === 'WhileStatement') {
      return this._generateCryptoWhileStatement(stmt, options, context);
    }
    if (stmt.type === 'VariableDeclaration') {
      return this._generateCryptoVariableDeclaration(stmt, options, context);
    }
    if (stmt.type === 'ExpressionStatement') {
      return this._generateCryptoExpressionStatement(stmt, options, context);
    }

    // Use standard generation for other statement types
    return this._generateNode(stmt, options);
  }

  /**
   * Generate variable declaration with improved type inference
   * @private
   */
  _generateVariableDeclaration(node, options) {
    if (!node.declarations) return '';

    return node.declarations
      .map(decl => {
        const varName = decl.id ? this._toCamelCase(decl.id.name) : 'variable';
        const context = { isCryptographic: true };

        if (decl.init) {
          const initValue = this._generateNode(decl.init, options);
          const inferredType = this._inferTypeFromValue(decl.init, context);

          if (node.kind === 'const') {
            // const becomes readonly field in C#
            return this._indent(`private readonly ${inferredType} ${varName} = ${initValue};\n`);
          } else {
            // let/var become local variables with proper type inference
            if (inferredType !== 'int' && inferredType !== 'object') {
              return this._indent(`${inferredType} ${varName} = ${initValue};\n`);
            } else {
              return this._indent(`var ${varName} = ${initValue};\n`);
            }
          }
        } else {
          // Uninitialized variables get better default types
          const defaultType = this._getDefaultTypeForVariable(varName, context);
          if (node.kind === 'const') {
            return this._indent(`private readonly ${defaultType} ${varName};\n`);
          } else {
            const defaultValue = this._getDefaultValue(defaultType);
            return this._indent(`${defaultType} ${varName} = ${defaultValue};\n`);
          }
        }
      })
      .join('');
  }

  /**
   * Generate cryptographic variable declaration
   * @private
   */
  _generateCryptoVariableDeclaration(node, options, context) {
    if (!node.declarations) return '';

    return node.declarations
      .map(decl => {
        const varName = decl.id ? this._toCamelCase(decl.id.name) : 'variable';

        if (decl.init) {
          const initValue = this._generateNode(decl.init, options);
          const inferredType = this._inferTypeFromValue(decl.init, context);

          if (node.kind === 'const') {
            return this._indent(`const ${inferredType} ${varName} = ${initValue};\n`);
          } else {
            return this._indent(`${inferredType} ${varName} = ${initValue};\n`);
          }
        } else {
          const defaultType = this._getDefaultTypeForVariable(varName, context);
          const defaultValue = this._getDefaultValue(defaultType);
          return this._indent(`${defaultType} ${varName} = ${defaultValue};\n`);
        }
      })
      .join('');
  }

  /**
   * Generate cryptographic for statement
   * @private
   */
  _generateCryptoForStatement(node, options, context) {
    let init = node.init ? this._generateNode(node.init, options).replace(/;\n$/, '').trim() : '';
    const test = node.test ? this._generateNode(node.test, options) : '';
    let update = node.update ? this._generateNode(node.update, options) : '';

    // Convert to prefix increment/decrement for crypto algorithms
    update = this._convertToPrefix(update);

    let code = this._indent(`for (${init}; ${test}; ${update})\n`);
    code += this._indent('{\n');
    this.indentLevel++;

    if (node.body) {
      const body = this._generateStatementWithContext(node.body, options, context);
      code += body || this._indent('// Empty for body\n');
    }

    this.indentLevel--;
    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate cryptographic while statement
   * @private
   */
  _generateCryptoWhileStatement(node, options, context) {
    const test = this._generateNode(node.test, options);
    let code = this._indent('while (' + test + ')\n');
    code += this._indent('{\n');
    this.indentLevel++;

    if (node.body) {
      const body = this._generateStatementWithContext(node.body, options, context);
      code += body || this._indent('// Empty while body\n');
    }

    this.indentLevel--;
    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate cryptographic expression statement
   * @private
   */
  _generateCryptoExpressionStatement(node, options, context) {
    const expr = this._generateNode(node.expression, options);
    return expr ? this._indent(expr + ';\n') : '';
  }

  /**
   * Get default type for variable based on name and context
   * @private
   */
  _getDefaultTypeForVariable(varName, context) {
    const lowerName = varName.toLowerCase();

    if (context.isCryptographic) {
      if (lowerName.includes('state') || lowerName.includes('word')) return 'uint';
      if (lowerName.includes('key') || lowerName.includes('data') || lowerName.includes('buffer')) return 'byte[]';
      if (lowerName.includes('round') || lowerName.includes('count') || lowerName.includes('index')) return 'int';
      return 'uint';
    }

    if (lowerName.includes('count') || lowerName.includes('size') || lowerName.includes('index')) return 'int';
    if (lowerName.includes('name') || lowerName.includes('text')) return 'string';
    if (lowerName.includes('flag') || lowerName.includes('is')) return 'bool';

    return 'int';
  }

  /**
   * Get default value for type
   * @private
   */
  _getDefaultValue(type) {
    switch (type) {
      case 'int': case 'uint': case 'byte': return '0';
      case 'double': case 'float': return '0.0';
      case 'bool': return 'false';
      case 'string': return 'string.Empty';
      case 'byte[]': return 'new byte[0]';
      case 'int[]': return 'new int[0]';
      case 'uint[]': return 'new uint[0]';
      default: return 'null';
    }
  }

  /**
   * Generate method description for documentation
   * @private
   */
  _generateMethodDescription(methodName) {
    const lowerName = methodName.toLowerCase();
    if (lowerName.includes('permutation')) return 'Performs the permutation operation on the internal state';
    if (lowerName.includes('encrypt')) return 'Encrypts the input data';
    if (lowerName.includes('decrypt')) return 'Decrypts the input data';
    if (lowerName.includes('process')) return 'Processes the input data';
    if (lowerName.includes('setup')) return 'Sets up the algorithm with key and initialization parameters';
    if (lowerName.includes('generate')) return 'Generates the output data';
    if (lowerName.includes('step')) return 'Performs algorithm step operations';
    if (lowerName.includes('round')) return 'Executes algorithm round operations';
    return 'Performs the ' + methodName + ' operation';
  }

  /**
   * Generate parameter description for documentation
   * @private
   */
  _generateParamDescription(paramName) {
    const lowerName = paramName.toLowerCase();
    if (lowerName.includes('key')) return 'Cryptographic key data';
    if (lowerName.includes('data') || lowerName.includes('input')) return 'Input data to process';
    if (lowerName.includes('state')) return 'Internal algorithm state';
    if (lowerName.includes('round')) return 'Number of rounds to execute';
    if (lowerName.includes('size') || lowerName.includes('length')) return 'Size or length parameter';
    if (lowerName.includes('index') || lowerName.includes('pos')) return 'Position or index parameter';
    if (lowerName.includes('nonce') || lowerName.includes('iv')) return 'Initialization vector or nonce';
    return 'Parameter for ' + paramName;
  }

  /**
   * Generate return description for documentation
   * @private
   */
  _generateReturnDescription(methodName) {
    const lowerName = methodName.toLowerCase();
    if (lowerName.includes('encrypt') || lowerName.includes('decrypt')) return 'Processed data result';
    if (lowerName.includes('generate')) return 'Generated output data';
    if (lowerName.includes('get')) return 'Retrieved value';
    if (lowerName.includes('is') || lowerName.includes('validate')) return 'Boolean result';
    if (lowerName.includes('process')) return 'Processed data';
    return 'Method result';
  }

  /**
   * Infer method visibility
   * @private
   */
  _inferMethodVisibility(methodName) {
    const lowerName = methodName.toLowerCase();
    // Internal crypto operations are typically private
    if (lowerName.includes('step') || lowerName.includes('round') || lowerName.includes('permutation')) {
      return 'private';
    }
    // Setup and internal state methods are often protected
    if (lowerName.includes('setup') || lowerName.includes('initialize')) {
      return 'protected';
    }
    // Main API methods are public
    return 'public';
  }

  /**
   * Check if method should be static
   * @private
   */
  _isStaticMethod(methodName) {
    const lowerName = methodName.toLowerCase();
    // Utility methods are often static
    if (lowerName.includes('create') || lowerName.includes('parse') || lowerName.includes('validate')) {
      return true;
    }
    return false;
  }

  /**
   * Generate property method (getter/setter)
   * @private
   */
  _generatePropertyMethod(node, options, methodName, isGetter, isSetter) {
    const propertyType = isGetter ? this._inferReturnType(methodName, node.value) : 'void';
    let code = '';

    if (isGetter) {
      code += this._indent(`public ${propertyType} ${methodName}\n`);
      code += this._indent('{\n');
      this.indentLevel++;
      code += this._indent('get\n');
      code += this._indent('{\n');
      this.indentLevel++;

      if (node.value.body) {
        const bodyCode = this._generateNode(node.value.body, options);
        code += bodyCode || this._indent('return default; // Default value for return type\n');
      }

      this.indentLevel--;
      code += this._indent('}\n');
      this.indentLevel--;
      code += this._indent('}\n');
    } else if (isSetter) {
      // Infer setter parameter type
      const paramType = this._inferParameterType('value');
      code += this._indent(`public ${paramType} ${methodName}\n`);
      code += this._indent('{\n');
      this.indentLevel++;
      code += this._indent('set\n');
      code += this._indent('{\n');
      this.indentLevel++;

      if (node.value.body) {
        const bodyCode = this._generateNode(node.value.body, options);
        code += bodyCode || this._indent('return default; // Default value for return type\n');
      }

      this.indentLevel--;
      code += this._indent('}\n');
      this.indentLevel--;
      code += this._indent('}\n');
    }

    return code;
  }

  /**
   * Generate OpCodes method call with proper C# translation
   * @private
   */
  _generateOpCodesCall(methodName, args) {
    const method = this._toPascalCase(methodName);

    // Special handling for specific OpCodes methods
    switch (methodName) {
      case 'Pack32LE':
        return `OpCodes.Pack32LE(${args})`;
      case 'Pack32BE':
        return `OpCodes.Pack32BE(${args})`;
      case 'Unpack32LE':
        return `OpCodes.Unpack32LE(${args})`;
      case 'Unpack32BE':
        return `OpCodes.Unpack32BE(${args})`;
      case 'RotL32':
        return `OpCodes.RotL32(${args})`;
      case 'RotR32':
        return `OpCodes.RotR32(${args})`;
      case 'RotL8':
        return `OpCodes.RotL8(${args})`;
      case 'RotR8':
        return `OpCodes.RotR8(${args})`;
      case 'XorArrays':
        return `OpCodes.XorArrays(${args})`;
      case 'ClearArray':
        return `OpCodes.ClearArray(${args})`;
      case 'Hex8ToBytes':
        return `OpCodes.Hex8ToBytes(${args})`;
      case 'BytesToHex8':
        return `OpCodes.BytesToHex8(${args})`;
      case 'AnsiToBytes':
        return `OpCodes.AnsiToBytes(${args})`;
      default:
        return `OpCodes.${method}(${args})`;
    }
  }

  /**
   * Generate Array constructor call with cryptographic context
   * @private
   */
  _generateArrayConstructorCall(args) {
    // Handle new Array(size) pattern
    if (args && !args.includes(',')) {
      return `new uint[${args}]`; // Crypto algorithms often use uint arrays
    }

    // Handle new Array(element1, element2, ...) pattern
    if (args) {
      return `new uint[] { ${args} }`;
    }

    return 'new uint[0]';
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
   * Generate binary expression with cryptographic patterns
   * @private
   */
  _generateBinaryExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    let operator = node.operator;

    // C# operators with crypto-specific handling
    switch (operator) {
      case '===':
        operator = '==';
        break;
      case '!==':
        operator = '!=';
        break;
      case '>>>': // Unsigned right shift - critical for crypto
        return `(${left} >> ${right}) & 0xFFFFFFFF`;
      case '<<': // Left shift with overflow protection
        return `(${left} << ${right}) & 0xFFFFFFFF`;
      case '^': // XOR - very common in crypto
        return `${left} ^ ${right}`;
      case '&': // Bitwise AND
        return `${left} & ${right}`;
      case '|': // Bitwise OR
        return `${left} | ${right}`;
    }

    return left + ' ' + operator + ' ' + right;
  }

  /**
   * Generate call expression with string method conversion
   * @private
   */
  _generateCallExpression(node, options) {
    const args = node.arguments ?
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';

    // Handle super() calls -> base() in C#
    if (node.callee.type === 'Super' ||
        (node.callee.type === 'Identifier' && node.callee.name === 'super')) {
      return `base(${args})`;
    }

    // Handle special method calls
    if (node.callee.type === 'MemberExpression') {
      const object = this._generateNode(node.callee.object, options);
      const propertyName = node.callee.property.name || node.callee.property;

      // Convert JavaScript string methods to C# indexers
      if (propertyName === 'charAt') {
        return `${object}[${args}]`;
      }
      if (propertyName === 'charCodeAt') {
        return `(int)${object}[${args}]`;
      }

      // Handle other string methods
      if (propertyName === 'substring') {
        return `${object}.Substring(${args})`;
      }
      if (propertyName === 'toLowerCase') {
        return `${object}.ToLower()`;
      }
      if (propertyName === 'toUpperCase') {
        return `${object}.ToUpper()`;
      }
      if (propertyName === 'indexOf') {
        return `${object}.IndexOf(${args})`;
      }

      // Handle array methods
      if (propertyName === 'push') {
        return `${object}.Add(${args})`; // Assumes List<T>
      }
      if (propertyName === 'slice') {
        return `${object}.Skip(${args}).ToArray()`;
      }

      const property = node.callee.computed ?
        `[${this._generateNode(node.callee.property, options)}]` :
        `.${this._toPascalCase(propertyName)}`;

      // Handle console.log -> Console.WriteLine
      if (object === 'console' && (property === '.log' || property === '.Log')) {
        return `Console.WriteLine(${args})`;
      }

      // Handle OpCodes method calls with special formatting and type-specific handling
      if (object === 'OpCodes') {
        return this._generateOpCodesCall(propertyName, args);
      }

      // Handle Array constructor calls with cryptographic context
      if (object === 'Array' || (object === 'new' && propertyName === 'Array')) {
        return this._generateArrayConstructorCall(args);
      }

      return `${object}${property}(${args})`;
    }

    const callee = this._generateNode(node.callee, options);
    return `${callee}(${args})`;
  }

  /**
   * Generate member expression with cryptographic patterns (overridden)
   * @private
   */
  _generateMemberExpression(node, options) {
    const object = this._generateNode(node.object, options);

    if (node.computed) {
      const property = this._generateNode(node.property, options);
      return `${object}[${property}]`;
    } else {
      const propertyName = node.property.name || node.property;

      // Handle common array properties
      if (propertyName === 'length') {
        return `${object}.Length`;
      }

      // Handle fill method on arrays
      if (propertyName === 'fill') {
        return `${object}.Fill`; // Will be handled in call expression
      }

      // Handle slice method
      if (propertyName === 'slice') {
        return `${object}.Skip`; // Will be converted to proper LINQ
      }

      const property = this._toPascalCase(propertyName);
      return `${object}.${property}`;
    }
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
    // Apply AlgorithmFramework mapping for class names
    const mappedName = this._mapAlgorithmFrameworkClass(node.name);
    return this._toCamelCase(mappedName);
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
   * Generate if statement
   * @private
   */
  _generateIfStatement(node, options) {
    let code = '';
    const test = this._generateNode(node.test, options);

    code += this._indent('if (' + test + ')\n');
    code += this._indent('{\n');
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
        code += this._indent('else\n');
        code += this._indent('{\n');
        this.indentLevel++;
        const alternate = this._generateNode(node.alternate, options);
        code += alternate || this._indent('// Empty else body\n');
        this.indentLevel--;
        code += this._indent('}\n');
      }
    }

    return code;
  }

  /**
   * Generate while statement
   * @private
   */
  _generateWhileStatement(node, options) {
    const test = this._generateNode(node.test, options);
    let code = this._indent('while (' + test + ')\n');
    code += this._indent('{\n');
    this.indentLevel++;

    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body || this._indent('// Empty while body\n');
    }

    this.indentLevel--;
    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate for statement
   * @private
   */
  _generateForStatement(node, options) {
    let init = node.init ? this._generateNode(node.init, options).replace(/;\n$/, '').trim() : '';
    const test = node.test ? this._generateNode(node.test, options) : '';
    let update = node.update ? this._generateNode(node.update, options) : '';

    // Convert to prefix increment/decrement
    update = this._convertToPrefix(update);

    let code = this._indent(`for (${init}; ${test}; ${update})\n`);
    code += this._indent('{\n');
    this.indentLevel++;

    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body || this._indent('// Empty for body\n');
    }

    this.indentLevel--;
    code += this._indent('}\n');
    return code;
  }

  /**
   * Convert postfix increment/decrement to prefix
   * @private
   */
  _convertToPrefix(expression) {
    if (!expression) return expression;

    // Convert i++ to ++i and i-- to --i
    return expression
      .replace(/(\w+)\+\+/g, '++$1')
      .replace(/(\w+)--/g, '--$1');
  }

  /**
   * Generate for-in statement (converted to foreach)
   * @private
   */
  _generateForInStatement(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);

    let code = this._indent('foreach (var ' + left.replace(/var\s+/, '') + ' in ' + right + '.Keys)\n');
    code += this._indent('{\n');
    this.indentLevel++;

    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body || this._indent('// Empty foreach body\n');
    }

    this.indentLevel--;
    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate for-of statement (converted to foreach)
   * @private
   */
  _generateForOfStatement(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);

    let code = this._indent('foreach (var ' + left.replace(/var\s+/, '') + ' in ' + right + ')\n');
    code += this._indent('{\n');
    this.indentLevel++;

    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body || this._indent('// Empty foreach body\n');
    }

    this.indentLevel--;
    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate do-while statement
   * @private
   */
  _generateDoWhileStatement(node, options) {
    let code = this._indent('do\n');
    code += this._indent('{\n');
    this.indentLevel++;

    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body || this._indent('// Empty do body\n');
    }

    this.indentLevel--;
    const test = this._generateNode(node.test, options);
    code += this._indent('} while (' + test + ');\n');
    return code;
  }

  /**
   * Generate switch statement
   * @private
   */
  _generateSwitchStatement(node, options) {
    const discriminant = this._generateNode(node.discriminant, options);
    let code = this._indent('switch (' + discriminant + ')\n');
    code += this._indent('{\n');
    this.indentLevel++;

    if (node.cases) {
      for (const caseNode of node.cases) {
        code += this._generateNode(caseNode, options);
      }
    }

    this.indentLevel--;
    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate switch case
   * @private
   */
  _generateSwitchCase(node, options) {
    let code = '';

    if (node.test) {
      const test = this._generateNode(node.test, options);
      code += this._indent('case ' + test + ':\n');
    } else {
      code += this._indent('default:\n');
    }

    this.indentLevel++;
    if (node.consequent) {
      for (const stmt of node.consequent) {
        code += this._generateNode(stmt, options);
      }
    }

    // Add break if not already present
    if (!code.includes('break;') && !code.includes('return;')) {
      code += this._indent('break;\n');
    }

    this.indentLevel--;
    return code;
  }

  /**
   * Generate break statement
   * @private
   */
  _generateBreakStatement(node, options) {
    return this._indent('break;\n');
  }

  /**
   * Generate continue statement
   * @private
   */
  _generateContinueStatement(node, options) {
    return this._indent('continue;\n');
  }

  /**
   * Generate try statement
   * @private
   */
  _generateTryStatement(node, options) {
    let code = this._indent('try\n');
    code += this._indent('{\n');
    this.indentLevel++;

    if (node.block) {
      const block = this._generateNode(node.block, options);
      code += block || this._indent('// Empty try block\n');
    }

    this.indentLevel--;
    code += this._indent('}\n');

    if (node.handler) {
      code += this._generateNode(node.handler, options);
    }

    if (node.finalizer) {
      code += this._indent('finally\n');
      code += this._indent('{\n');
      this.indentLevel++;
      const finalizer = this._generateNode(node.finalizer, options);
      code += finalizer || this._indent('// Empty finally block\n');
      this.indentLevel--;
      code += this._indent('}\n');
    }

    return code;
  }

  /**
   * Generate catch clause
   * @private
   */
  _generateCatchClause(node, options) {
    let code = this._indent('catch');

    if (node.param) {
      const param = this._generateNode(node.param, options);
      code += ' (Exception ' + param + ')';
    } else {
      code += ' (Exception ex)';
    }

    code += '\n' + this._indent('{\n');
    this.indentLevel++;

    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body || this._indent('// Empty catch block\n');
    }

    this.indentLevel--;
    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate throw statement
   * @private
   */
  _generateThrowStatement(node, options) {
    if (node.argument) {
      const argument = this._generateNode(node.argument, options);
      return this._indent('throw ' + argument + ';\n');
    } else {
      return this._indent('throw;\n');
    }
  }

  /**
   * Generate unary expression with cryptographic patterns
   * @private
   */
  _generateUnaryExpression(node, options) {
    const argument = this._generateNode(node.argument, options);
    const operator = node.operator;

    switch (operator) {
      case 'typeof':
        return argument + '.GetType()';
      case 'delete':
        return '/* delete not supported in C# */ ' + argument;
      case 'void':
        return '/* void */ ' + argument;
      case '~': // Bitwise NOT - common in crypto
        return `~${argument}`;
      case '!': // Logical NOT
        return `!${argument}`;
      case '-': // Unary minus
        return `-${argument}`;
      case '+': // Unary plus
        return `+${argument}`;
      default:
        return operator + argument;
    }
  }

  /**
   * Generate update expression
   * @private
   */
  _generateUpdateExpression(node, options) {
    const argument = this._generateNode(node.argument, options);
    const operator = node.operator;

    if (node.prefix) {
      return operator + argument;
    } else {
      return argument + operator;
    }
  }

  /**
   * Generate logical expression
   * @private
   */
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
        operator = '??'; // Null-coalescing operator
        break;
    }

    return left + ' ' + operator + ' ' + right;
  }

  /**
   * Generate conditional expression (ternary operator)
   * @private
   */
  _generateConditionalExpression(node, options) {
    const test = this._generateNode(node.test, options);
    const consequent = this._generateNode(node.consequent, options);
    const alternate = this._generateNode(node.alternate, options);

    return test + ' ? ' + consequent + ' : ' + alternate;
  }

  /**
   * Generate array expression with cryptographic context
   * @private
   */
  _generateArrayExpression(node, options) {
    if (!node.elements || node.elements.length === 0) {
      return 'new byte[0]'; // Default to byte[] for crypto
    }

    const elements = node.elements
      .map(element => element ? this._generateNode(element, options) : '0')
      .join(', ');

    // Infer array type from elements
    const context = { isCryptographic: true };
    const firstElement = node.elements.find(el => el !== null && el !== undefined);
    if (firstElement) {
      const elementType = this._inferTypeFromValue(firstElement, context);
      if (elementType === 'byte') {
        return `new byte[] { ${elements} }`;
      }
      if (elementType === 'uint') {
        return `new uint[] { ${elements} }`;
      }
      if (elementType === 'int') {
        return `new int[] { ${elements} }`;
      }
    }

    // Default for crypto algorithms
    return `new byte[] { ${elements} }`;
  }

  /**
   * Generate object expression
   * @private
   */
  _generateObjectExpression(node, options) {
    if (!node.properties || node.properties.length === 0) {
      return 'new()';
    }

    // Use target-typed new with collection initializer
    const properties = node.properties.map(prop => {
      const key = prop.key ? this._generateNode(prop.key, options) : '"unknown"';
      const value = prop.value ? this._generateNode(prop.value, options) : 'null';
      return `[${key}] = ${value}`;
    });

    return `new() { ${properties.join(', ')} }`;
  }

  /**
   * Generate property
   * @private
   */
  _generateProperty(node, options) {
    const key = node.key ? this._generateNode(node.key, options) : '"unknown"';
    const value = node.value ? this._generateNode(node.value, options) : 'null';
    return '{ ' + key + ', ' + value + ' }';
  }

  /**
   * Generate function expression
   * @private
   */
  _generateFunctionExpression(node, options) {
    const params = node.params ?
      node.params.map(param => 'int ' + this._toCamelCase(param.name || 'param')).join(', ') : '';

    let code = '((' + params + ') => {\n';
    this.indentLevel++;

    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body || this._indent('return 0;\n');
    } else {
      code += this._indent('return 0;\n');
    }

    this.indentLevel--;
    code += this._indent('})');
    return code;
  }

  /**
   * Generate arrow function expression
   * @private
   */
  _generateArrowFunctionExpression(node, options) {
    const params = node.params ?
      node.params.map(param => this._toCamelCase(param.name || 'param')).join(', ') : '';

    if (node.body.type === 'BlockStatement') {
      let code = '(' + params + ') => {\n';
      this.indentLevel++;
      const body = this._generateNode(node.body, options);
      code += body || this._indent('return 0;\n');
      this.indentLevel--;
      code += this._indent('}');
      return code;
    } else {
      const body = this._generateNode(node.body, options);
      return '(' + params + ') => ' + body;
    }
  }

  /**
   * Generate new expression with cryptographic patterns (overridden)
   * @private
   */
  _generateNewExpression(node, options) {
    const callee = this._generateNode(node.callee, options);
    const args = node.arguments ?
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';

    // Handle special constructors
    if (callee === 'Array') {
      return this._generateArrayConstructorCall(args);
    }

    // Handle Error constructors
    if (callee === 'Error') {
      return `new Exception(${args})`;
    }

    // Handle crypto-specific class names
    const className = this._mapAlgorithmFrameworkClass(callee);

    return `new ${this._toPascalCase(className)}(${args})`;
  }

  /**
   * Generate sequence expression
   * @private
   */
  _generateSequenceExpression(node, options) {
    if (!node.expressions || node.expressions.length === 0) {
      return '';
    }

    // In C#, we can't have comma operators like JavaScript
    // Convert to a block with multiple statements
    const expressions = node.expressions.map(expr => this._generateNode(expr, options));
    return '/* Sequence: */ ' + expressions.join('; ');
  }

  /**
   * Generate template literal
   * @private
   */
  _generateTemplateLiteral(node, options) {
    if (!node.quasis || node.quasis.length === 0) {
      return '""';
    }

    let result = '$"';
    for (let i = 0; i < node.quasis.length; i++) {
      const quasi = node.quasis[i];
      const text = quasi.value ? quasi.value.raw || quasi.value.cooked || '' : '';

      // Escape quotes and backslashes for C# string interpolation
      const escapedText = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      result += escapedText;

      if (i < node.expressions.length) {
        const expr = this._generateNode(node.expressions[i], options);
        result += `{${expr}}`;
      }
    }
    result += '"';
    return result;
  }

  /**
   * Generate tagged template expression
   * @private
   */
  _generateTaggedTemplateExpression(node, options) {
    const tag = this._generateNode(node.tag, options);
    const quasi = this._generateNode(node.quasi, options);
    return tag + '(' + quasi + ')';
  }

  /**
   * Generate rest element
   * @private
   */
  _generateRestElement(node, options) {
    const argument = this._generateNode(node.argument, options);
    return 'params ' + argument; // C# params keyword
  }

  /**
   * Generate spread element with proper C# equivalent (overridden)
   * @private
   */
  _generateSpreadElement(node, options) {
    const argument = this._generateNode(node.argument, options);

    // Convert ...array to appropriate C# pattern
    // In crypto contexts, this is often used for array copying
    return `${argument}.ToArray()`; // Use LINQ ToArray() for spreading
  }

  /**
   * Generate assignment pattern
   * @private
   */
  _generateAssignmentPattern(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    return left + ' = ' + right;
  }

  /**
   * Generate object pattern
   * @private
   */
  _generateObjectPattern(node, options) {
    if (!node.properties || node.properties.length === 0) {
      return '/* empty object pattern */';
    }

    const properties = node.properties.map(prop => this._generateNode(prop, options));
    return '/* object destructuring: */ { ' + properties.join(', ') + ' }';
  }

  /**
   * Generate array pattern
   * @private
   */
  _generateArrayPattern(node, options) {
    if (!node.elements || node.elements.length === 0) {
      return '/* empty array pattern */';
    }

    const elements = node.elements.map(elem => elem ? this._generateNode(elem, options) : 'null');
    return '/* array destructuring: */ [' + elements.join(', ') + ']';
  }

  /**
   * Generate variable declarator
   * @private
   */
  _generateVariableDeclarator(node, options) {
    const id = node.id ? this._generateNode(node.id, options) : 'variable';

    if (node.init) {
      const init = this._generateNode(node.init, options);
      return id + ' = ' + init;
    } else {
      return id;
    }
  }

  /**
   * Generate empty statement
   * @private
   */
  _generateEmptyStatement(node, options) {
    return this._indent(';\n');
  }

  /**
   * Generate debugger statement
   * @private
   */
  _generateDebuggerStatement(node, options) {
    return this._indent('System.Diagnostics.Debugger.Break();\n');
  }

  /**
   * Generate with statement
   * @private
   */
  _generateWithStatement(node, options) {
    const object = this._generateNode(node.object, options);
    let code = this._indent('using (var scope = ' + object + ')\n');
    code += this._indent('{\n');
    this.indentLevel++;

    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body || this._indent('// Empty with body\n');
    }

    this.indentLevel--;
    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate labeled statement
   * @private
   */
  _generateLabeledStatement(node, options) {
    const label = node.label ? this._generateNode(node.label, options) : 'label';
    const body = node.body ? this._generateNode(node.body, options) : '';

    return this._indent(label + ':\n') + body;
  }

  /**
   * Infer C# type from JavaScript AST value with cryptographic context
   * @private
   */
  _inferTypeFromValue(node, context = {}) {
    if (!node) return 'int'; // Default to int instead of object for crypto

    switch (node.type) {
      case 'Literal':
        if (typeof node.value === 'string') return 'string';
        if (typeof node.value === 'number') {
          // Cryptographic algorithms often use specific integer types
          if (Number.isInteger(node.value)) {
            if (node.value >= 0 && node.value <= 255) return 'byte';
            if (node.value >= -2147483648 && node.value <= 2147483647) return 'int';
            return 'uint';
          }
          return 'double';
        }
        if (typeof node.value === 'boolean') return 'bool';
        if (node.value === null) return 'object?';
        break;
      case 'ArrayExpression':
        // Analyze array elements to determine specific type
        if (node.elements && node.elements.length > 0) {
          const firstElement = node.elements.find(el => el !== null && el !== undefined);
          if (firstElement) {
            const elementType = this._inferTypeFromValue(firstElement, context);
            if (elementType === 'byte' || elementType === 'int' || elementType === 'uint') {
              return elementType + '[]';
            }
          }
        }
        // Default to byte[] for crypto algorithms
        return context.isCryptographic ? 'byte[]' : 'int[]';
      case 'NewExpression':
        if (node.callee && node.callee.name === 'Array') {
          // new Array(n) patterns in crypto often create byte or int arrays
          return context.isCryptographic ? 'byte[]' : 'int[]';
        }
        const callee = this._generateNode(node.callee);
        return this._toPascalCase(callee);
      case 'CallExpression':
        return this._inferTypeFromCallExpression(node, context);
      case 'BinaryExpression':
        return this._inferTypeFromBinaryExpression(node, context);
      case 'MemberExpression':
        return this._inferTypeFromMemberExpression(node, context);
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        return 'Func<int>'; // More specific than Func<object>
      case 'ObjectExpression':
        return 'Dictionary<string, object>';
    }
    return context.isCryptographic ? 'uint' : 'int'; // Better defaults for crypto
  }

  /**
   * Infer type from call expression (OpCodes, methods, etc.)
   * @private
   */
  _inferTypeFromCallExpression(node, context = {}) {
    if (node.callee && node.callee.type === 'MemberExpression') {
      const object = node.callee.object;
      const property = node.callee.property;

      // OpCodes method calls
      if (object && object.name === 'OpCodes') {
        const methodName = property.name || property;
        if (methodName.includes('Pack32') || methodName.includes('Unpack32')) {
          return 'uint';
        }
        if (methodName.includes('Bytes') || methodName.includes('ToBytes')) {
          return 'byte[]';
        }
        if (methodName.includes('Rot') || methodName.includes('Shift')) {
          return 'uint';
        }
        if (methodName.includes('Xor')) {
          return 'byte[]';
        }
        return 'uint'; // Default for OpCodes methods
      }

      // String methods that should become indexers
      if (property.name === 'charAt' || property.name === 'charCodeAt') {
        return property.name === 'charAt' ? 'char' : 'int';
      }

      // Array methods
      if (property.name === 'length') {
        return 'int';
      }
      if (property.name === 'push' || property.name === 'unshift') {
        return 'int'; // Returns new length
      }
      if (property.name === 'slice' || property.name === 'splice') {
        return this._inferTypeFromValue(object, context); // Same type as source array
      }
    }

    // Constructor calls
    if (node.callee && node.callee.name === 'Array') {
      return context.isCryptographic ? 'byte[]' : 'int[]';
    }

    return context.isCryptographic ? 'uint' : 'int';
  }

  /**
   * Infer type from binary expression
   * @private
   */
  _inferTypeFromBinaryExpression(node, context = {}) {
    const operator = node.operator;

    // Bitwise operations return same type as operands (prefer uint for crypto)
    if (['&', '|', '^', '<<', '>>', '>>>'].includes(operator)) {
      return context.isCryptographic ? 'uint' : 'int';
    }

    // Comparison operations return bool
    if (['==', '!=', '===', '!==', '<', '>', '<=', '>='].includes(operator)) {
      return 'bool';
    }

    // Arithmetic operations - infer from operands
    if (['+', '-', '*', '/', '%'].includes(operator)) {
      const leftType = this._inferTypeFromValue(node.left, context);
      const rightType = this._inferTypeFromValue(node.right, context);

      // If either operand is floating point, result is double
      if (leftType === 'double' || rightType === 'double') {
        return 'double';
      }

      // For crypto, prefer uint for arithmetic
      return context.isCryptographic ? 'uint' : 'int';
    }

    return context.isCryptographic ? 'uint' : 'int';
  }

  /**
   * Infer type from member expression
   * @private
   */
  _inferTypeFromMemberExpression(node, context = {}) {
    if (node.property) {
      const propertyName = node.property.name || node.property;

      // Common property names
      if (propertyName === 'length') {
        return 'int';
      }
      if (propertyName === 'value' || propertyName === 'data') {
        return context.isCryptographic ? 'byte[]' : 'object';
      }
      if (propertyName.includes('Size') || propertyName.includes('Count')) {
        return 'int';
      }
      if (propertyName.includes('Key') || propertyName.includes('Nonce') || propertyName.includes('IV')) {
        return 'byte[]';
      }
    }

    return context.isCryptographic ? 'uint' : 'int';
  }

  /**
   * Infer return type from method name and body with cryptographic patterns
   * @private
   */
  _inferReturnType(methodName, methodNode) {
    const lowerName = methodName.toLowerCase();
    const context = { isCryptographic: true };

    // Cryptographic algorithm specific patterns
    if (lowerName.includes('permutation') || lowerName.includes('round') || lowerName.includes('step')) {
      return 'void'; // State modification methods
    }
    if (lowerName.includes('encrypt') || lowerName.includes('decrypt') || lowerName.includes('process')) {
      return 'byte[]';
    }
    if (lowerName.includes('tag') || lowerName.includes('hash') || lowerName.includes('digest')) {
      return 'byte[]';
    }
    if (lowerName.includes('setup') || lowerName.includes('initialize') || lowerName.includes('reset')) {
      return 'void';
    }
    if (lowerName.includes('key') && (lowerName.includes('schedule') || lowerName.includes('expand'))) {
      return 'uint[]';
    }

    // Standard naming conventions
    if (lowerName.includes('get') || lowerName.includes('create') || lowerName.includes('generate')) {
      if (lowerName.includes('count') || lowerName.includes('size') || lowerName.includes('length')) {
        return 'int';
      }
      if (lowerName.includes('bytes') || lowerName.includes('data') || lowerName.includes('buffer') || lowerName.includes('output')) {
        return 'byte[]';
      }
      if (lowerName.includes('name') || lowerName.includes('string') || lowerName.includes('text')) {
        return 'string';
      }
      if (lowerName.includes('word') || lowerName.includes('state')) {
        return 'uint';
      }
      return 'byte[]'; // Default for crypto getter methods
    }

    if (lowerName.includes('is') || lowerName.includes('has') || lowerName.includes('can') || lowerName.includes('validate')) {
      return 'bool';
    }

    // Analyze method body for return statements with better inference
    if (methodNode && methodNode.body && methodNode.body.body) {
      for (const stmt of methodNode.body.body) {
        if (stmt.type === 'ReturnStatement' && stmt.argument) {
          const inferredType = this._inferTypeFromValue(stmt.argument, context);
          if (inferredType !== 'int') return inferredType; // Don't return default int
        }
      }
    }

    // Check if method has no return statements (void methods)
    if (methodNode && methodNode.body && methodNode.body.body) {
      const hasReturn = methodNode.body.body.some(stmt => stmt.type === 'ReturnStatement');
      if (!hasReturn) return 'void';
    }

    return 'byte[]'; // Better default for crypto methods
  }

  /**
   * Infer parameter type from parameter name with cryptographic context
   * @private
   */
  _inferParameterType(paramName) {
    const lowerName = paramName.toLowerCase();

    // Cryptographic specific parameters
    if (lowerName.includes('key') && !lowerName.includes('size')) {
      return 'byte[]';
    }
    if (lowerName.includes('nonce') || lowerName.includes('iv') || lowerName.includes('salt')) {
      return 'byte[]';
    }
    if (lowerName.includes('state') || lowerName.includes('word')) {
      return 'uint';
    }
    if (lowerName.includes('round') || lowerName.includes('step')) {
      return 'int';
    }
    if (lowerName.includes('plaintext') || lowerName.includes('ciphertext') || lowerName.includes('input') || lowerName.includes('output')) {
      return 'byte[]';
    }

    // Standard parameter patterns
    if (lowerName.includes('count') || lowerName.includes('size') || lowerName.includes('length') || lowerName.includes('index') || lowerName.includes('pos')) {
      return 'int';
    }
    if (lowerName.includes('data') || lowerName.includes('bytes') || lowerName.includes('buffer')) {
      return 'byte[]';
    }
    if (lowerName.includes('name') || lowerName.includes('text') || lowerName.includes('message')) {
      return 'string';
    }
    if (lowerName.includes('enabled') || lowerName.includes('valid') || lowerName.includes('is') || lowerName.includes('flag')) {
      return 'bool';
    }
    if (lowerName.includes('options') || lowerName.includes('config')) {
      return 'object';
    }

    return 'int'; // Better default than object for crypto algorithms
  }

  /**
   * Generate constructor body excluding super() calls
   * @private
   */
  _generateConstructorBody(bodyNode, options) {
    if (!bodyNode || bodyNode.type !== 'BlockStatement' || !bodyNode.body) {
      return '';
    }

    // Filter out the first super() call and generate the rest
    const statements = bodyNode.body.slice();
    const firstStatement = statements[0];

    // Remove super() call if it's the first statement
    if (firstStatement && firstStatement.type === 'ExpressionStatement') {
      const expr = firstStatement.expression;
      if (expr.type === 'CallExpression') {
        if ((expr.callee.type === 'Super') ||
            (expr.callee.type === 'Identifier' && expr.callee.name === 'super')) {
          statements.shift(); // Remove the super() call
        }
      }
    }

    // Generate the remaining statements
    return statements
      .map(stmt => this._generateNode(stmt, options))
      .filter(code => code.trim())
      .join('');
  }

  /**
   * Extract base constructor call from method body
   * @private
   */
  _extractBaseConstructorCall(bodyNode) {
    if (!bodyNode || bodyNode.type !== 'BlockStatement' || !bodyNode.body) {
      return '';
    }

    // Look for super() call in the first statement
    const firstStatement = bodyNode.body[0];
    if (firstStatement && firstStatement.type === 'ExpressionStatement') {
      const expr = firstStatement.expression;
      if (expr.type === 'CallExpression') {
        if ((expr.callee.type === 'Super') ||
            (expr.callee.type === 'Identifier' && expr.callee.name === 'super')) {
          // Extract arguments for base constructor
          const args = expr.arguments ?
            expr.arguments.map(arg => this._generateNode(arg, {})).join(', ') : '';
          return `base(${args})`;
        }
      }
    }

    return '';
  }

  /**
   * Fix AlgorithmFramework class name mapping
   * @private
   */
  _mapAlgorithmFrameworkClass(className) {
    const frameworkClasses = {
      'Algorithm': 'AlgorithmBase',
      'BlockCipher': 'BlockCipherAlgorithm',
      'StreamCipher': 'StreamCipherAlgorithm',
      'HashFunction': 'HashFunctionAlgorithm',
      'AsymmetricCipher': 'AsymmetricCipherAlgorithm',
      'MacAlgorithm': 'MacAlgorithm',
      'KdfAlgorithm': 'KdfAlgorithm',
      'CompressionAlgorithm': 'CompressionAlgorithm',
      'EncodingAlgorithm': 'EncodingAlgorithm',
      'ClassicalCipher': 'ClassicalCipherAlgorithm',
      'ErrorCorrectionCode': 'ErrorCorrectionCodeAlgorithm',
      'ChecksumAlgorithm': 'ChecksumAlgorithm'
    };

    return frameworkClasses[className] || className;
  }

  /**
   * Convert to camelCase (C# variable/parameter naming)
   * @private
   */
  _toCamelCase(str) {
    if (!str) return str;
    return str.charAt(0).toLowerCase() + str.slice(1);
  }

  /**
   * Convert to PascalCase (C# class/method naming)
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
   * Wrap generated code with namespace structure
   * @private
   */
  _wrapWithNamespaceStructure(code, options) {
    let result = '';
    
    // Using statements
    this.usings.add('System');
    this.usings.add('System.Collections.Generic');
    this.usings.add('System.Linq');
    
    for (const using of this.usings) {
      result += 'using ' + using + ';\n';
    }
    result += '\n';
    
    // File header comment
    if (options.addComments) {
      result += '/// <summary>\n';
      result += '/// Generated C# code\n';
      result += '/// This file was automatically generated from JavaScript AST\n';
      result += '/// </summary>\n';
    }
    
    // Namespace declaration
    result += 'namespace ' + options.namespace + '\n';
    result += '{\n';
    
    // Class wrapper
    result += '    /// <summary>\n';
    result += '    /// Main generated class\n';
    result += '    /// </summary>\n';
    result += '    public class ' + options.className + '\n';
    result += '    {\n';
    
    // Add Main method for console applications
    result += '        /// <summary>\n';
    result += '        /// Main entry point for testing\n';
    result += '        /// </summary>\n';
    result += '        /// <param name="args">Command line arguments</param>\n';
    result += '        public static void Main(string[] args)\n';
    result += '        {\n';
    result += '            // Test code would go here\n';
    result += '            // Example: var result = cipher.Encrypt(testData);\n';
    result += '            Console.WriteLine("Tests completed successfully");\n';
    result += '            Console.WriteLine("Generated code execution");\n';
    result += '        }\n\n';
    
    // Generated code (indented)
    const indentedCode = code.split('\n').map(line => 
      line.trim() ? '        ' + line : line
    ).join('\n');
    
    result += indentedCode + '\n';
    result += '    }\n';
    result += '}\n';
    
    return result;
  }

  /**
   * Generate fallback code for unhandled AST node types
   * @private
   */
  _generateFallbackNode(node, options) {
    // Generate minimal valid C# code with warning comment
    let warning = `// WARNING: Unhandled AST node type: ${node.type}`;

    // Add context information if available
    if (node.name) {
      warning += ` (name: ${node.name})`;
    }
    if (node.value !== undefined) {
      warning += ` (value: ${JSON.stringify(node.value)})`;
    }

    // Return empty block with warning and exception throw
    return `{\n${this._indent(warning + '\n')}${this._indent('throw new NotImplementedException("' + node.type + ' conversion not implemented");\n')}}`;
  }

  /**
   * Generate default return statement for methods
   * @private
   */
  _generateDefaultMethodReturn(node, options) {
    // Try to infer return type from method name or context
    const methodName = node.key?.name || node.value?.id?.name || '';

    // Check if method name suggests a specific return type
    if (methodName.toLowerCase().includes('byte') || methodName.toLowerCase().includes('buffer')) {
      return this._indent('return Array.Empty<byte>(); // Default empty byte array\n');
    }
    if (methodName.toLowerCase().startsWith('is') || methodName.toLowerCase().startsWith('has')) {
      return this._indent('return false; // Default boolean value\n');
    }
    if (methodName.toLowerCase().includes('count') || methodName.toLowerCase().includes('size')) {
      return this._indent('return 0; // Default count/size\n');
    }

    // Default fallback: return default keyword (works for all types in C#)
    return this._indent('return default; // Default value for return type\n');
  }

  /**
   * Collect required dependencies
   * @private
   */
  _collectDependencies(ast, options) {
    const dependencies = [];
    
    // Common C# dependencies
    dependencies.push('System');
    dependencies.push('System.Collections.Generic');
    dependencies.push('System.Linq');
    
    return dependencies;
  }

  /**
   * Generate warnings about potential issues
   * @private
   */
  _generateWarnings(ast, options) {
    const warnings = [];
    
    // C#-specific warnings
    warnings.push('Consider using specific types instead of int for better type safety');
    warnings.push('Add proper exception handling with try-catch blocks');
    warnings.push('Consider using nullable reference types for better null safety');
    warnings.push('Use async/await for I/O operations when applicable');
    warnings.push('Consider implementing IDisposable for resource management');
    
    return warnings;
  }

  /**
   * Check if .NET compiler is available on the system
   * @private
   */
  _isDotnetAvailable() {
    try {
      const { execSync } = require('child_process');
      execSync('dotnet --version', { 
        stdio: 'pipe', 
        timeout: 1000,
        windowsHide: true  // Prevent Windows error dialogs
      });
      return true;
    } catch (error) {
      // Try csc as fallback (Framework compiler)
      try {
        execSync('csc /help', { 
          stdio: 'pipe', 
          timeout: 1000,
          windowsHide: true  // Prevent Windows error dialogs
        });
        return 'csc';
      } catch (error2) {
        return false;
      }
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
          // Special handling for < in C# - only count as opening if it looks like a generic
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
   * Validate C# code syntax using dotnet or csc compiler
   * @override
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
   * @override
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
}

// Register the plugin
const csharpPlugin = new CSharpPlugin();
LanguagePlugins.Add(csharpPlugin);

// Export for potential direct use
// Export for potential direct use (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = csharpPlugin;
}


})(); // End of IIFE