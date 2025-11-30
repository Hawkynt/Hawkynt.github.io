/**
 * C# Language Plugin for Multi-Language Code Generation
 * Generates C# code from JavaScript AST
 *
 * Follows the LanguagePlugin specification exactly
 *
 * Supports two generation modes:
 * 1. Direct emission (legacy) - _generateNode directly emits C# code
 * 2. AST pipeline (new) - JS AST -> C# AST -> C# Emitter
 */

// Import the framework
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

  // Load new AST pipeline components
  try {
    CSharpAST = require('./CSharpAST.js');
    const emitterModule = require('./CSharpEmitter.js');
    CSharpEmitter = emitterModule.CSharpEmitter;
    const transformerModule = require('./CSharpTransformer.js');
    CSharpTransformer = transformerModule.CSharpTransformer;
  } catch (e) {
    // Pipeline components not available - will use legacy mode
    console.warn('C# AST pipeline components not loaded:', e.message);
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
    
    // Internal state
    this.indentLevel = 0;
    this.usings = new Set();
    this.typeMap = new Map(); // Maps AST nodes to inferred types
    this.listVariables = new Set(); // Tracks variables declared as List<T>
    this.functionRegistry = new Map(); // Maps function paths (e.g., "OpCodes.Pack32BE") to signatures
    this.variableTypes = new Map(); // Maps variable names to their C# types for type narrowing
  }

  /**
   * Generate C# code from Abstract Syntax Tree
   * @param {Object} ast - Parsed/Modified AST representation
   * @param {Object} options - Generation options
   * @returns {CodeGenerationResult}
   */
  GenerateFromAST(ast, options = {}) {
    // Save original options
    const originalOptions = this.options;

    try {
      // Merge options and temporarily set as instance options
      // This allows all helper methods to access the merged options via this.options
      const mergedOptions = { ...this.options, ...options };
      this.options = mergedOptions;

      // Validate AST
      if (!ast || typeof ast !== 'object') {
        return this.CreateErrorResult('Invalid AST: must be an object');
      }

      // Check if new AST pipeline is requested and available
      if (mergedOptions.useAstPipeline && CSharpTransformer && CSharpEmitter) {
        return this._generateWithAstPipeline(ast, mergedOptions);
      }

      // Reset state for clean generation (legacy mode)
      this.indentLevel = 0;
      this.usings.clear();
      this.typeMap.clear();
      this.listVariables.clear();
      this.functionRegistry.clear();
      this.variableTypes.clear();
      this.nestedClasses = []; // Reset nested classes from constructor patterns
      this.prototypeMethods = new Map(); // Store prototype methods by class name
      this.inlineObjectClasses = []; // Reset inline object classes from ES6 method shorthand
      this.inlineObjectClassCounter = 0; // Reset counter for unique class names

      // Use pre-computed type annotations from TypeAwareTranspiler if available
      if (mergedOptions.parser && mergedOptions.parser.typeAnnotations) {
        this.preComputedTypes = mergedOptions.parser.typeAnnotations;
      } else {
        this.preComputedTypes = null;
      }

      // Generate C# code using legacy direct emission
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
    } finally {
      // Restore original options
      this.options = originalOptions;
    }
  }

  /**
   * Generate C# code using the new AST pipeline
   * Pipeline: JS AST -> C# AST -> C# Emitter -> C# Source
   * @private
   */
  _generateWithAstPipeline(ast, options) {
    try {
      // Create transformer with options
      const transformer = new CSharpTransformer({
        namespace: options.namespace || 'Generated',
        className: options.className || 'GeneratedClass',
        typeKnowledge: options.parser?.typeKnowledge || options.typeKnowledge
      });

      // Transform JS AST to C# AST
      const csAst = transformer.transform(ast);

      // Create emitter with formatting options
      const emitter = new CSharpEmitter({
        indent: options.indent || '    ',
        lineEnding: options.lineEnding || '\n'
      });

      // Emit C# source code
      const code = emitter.emit(csAst);

      // Collect any warnings from transformation
      const warnings = transformer.warnings || [];

      return this.CreateSuccessResult(code, [], warnings);

    } catch (error) {
      return this.CreateErrorResult('AST pipeline generation failed: ' + error.message);
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
        // In method body context, generate as local function or nested class
        if (options && (options.isConstructorBody || options.isMethodBody)) {
          return this._generateNestedClassFromFunction(node, options);
        }
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
      .flatMap(stmt => {
        // Unwrap top-level IIFE wrappers (module patterns, UMD, etc.)
        // Extract their body content instead of skipping them
        if (stmt.type === 'ExpressionStatement' &&
            stmt.expression.type === 'CallExpression' &&
            (stmt.expression.callee.type === 'FunctionExpression' ||
             stmt.expression.callee.type === 'ArrowFunctionExpression')) {
          const iife = stmt.expression.callee;
          if (iife.body.type === 'BlockStatement') {
            // Return the IIFE body statements instead of the IIFE itself
            return iife.body.body;
          }
          // Skip if not a block statement
          return [];
        }

        // Skip post-object method assignments (e.g., TranspilerTestCases.AdditionalStatic = function...)
        if (stmt.type === 'ExpressionStatement' &&
            stmt.expression.type === 'AssignmentExpression' &&
            stmt.expression.left.type === 'MemberExpression') {
          return []; // Skip post-object assignments
        }

        return [stmt];
      })
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
      const bodyOptions = { ...options, isMethodBody: true };
      const bodyCode = this._generateNode(node.body, bodyOptions);
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

    // Pre-scan: Find patterns where a newly declared variable is later assigned or returned
    // e.g., const padded = new Array(4).fill(0); words16 = padded;
    // or: const result = new Array(8); ... return result;
    // This tells us padded should have the same type as words16 or function return type
    const variableTargetTypes = new Map();
    for (const stmt of node.body) {
      // Handle assignment patterns: existingVar = newlyDeclaredVar
      if (stmt.type === 'ExpressionStatement' && stmt.expression.type === 'AssignmentExpression') {
        const assign = stmt.expression;
        if (assign.operator === '=' &&
            assign.left.type === 'Identifier' &&
            assign.right.type === 'Identifier') {
          const target = assign.left.name;
          const source = assign.right.name;
          // If target is a parameter (has a known type), propagate type to source
          const targetType = this.variableTypes ? this.variableTypes.get(target) : null;
          if (targetType) {
            variableTargetTypes.set(source, targetType);
          }
        }
      }
      // Handle return patterns: return varName - variable should match function return type
      if (stmt.type === 'ReturnStatement' && stmt.argument) {
        const returnType = options?.returnType;
        if (returnType && stmt.argument.type === 'Identifier') {
          const varName = stmt.argument.name;
          // Don't overwrite if already set from assignment
          if (!variableTargetTypes.has(varName)) {
            variableTargetTypes.set(varName, returnType);
          }
        }
        // Also handle return result.toArray() -> result should match return type
        if (returnType && stmt.argument.type === 'CallExpression') {
          const callee = stmt.argument.callee;
          if (callee && callee.type === 'MemberExpression' &&
              callee.object?.type === 'Identifier' &&
              (callee.property?.name === 'toArray' || callee.property?.name === 'ToArray')) {
            const varName = callee.object.name;
            if (!variableTargetTypes.has(varName)) {
              variableTargetTypes.set(varName, returnType);
            }
          }
        }
      }
    }

    // Pass the variable target types in options for variable declaration generation
    const blockOptions = { ...options, variableTargetTypes };

    const statements = node.body
      .map(stmt => this._generateNode(stmt, blockOptions))
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
        const varName = decl.id ? (decl.id.name || 'variable') : 'variable';
        const context = { isCryptographic: true };

        if (decl.init) {
          // CRITICAL: Check if this is an object-as-namespace pattern
          // If so, generate as a static class instead of variable assignment
          if (decl.init.type === 'ObjectExpression' && decl.init.properties) {
            const functionOrObjectProps = decl.init.properties.filter(prop =>
              prop.value && (
                prop.value.type === 'FunctionExpression' ||
                prop.value.type === 'ArrowFunctionExpression' ||
                prop.value.type === 'ObjectExpression'
              )
            );

            const isNamespacePattern = functionOrObjectProps.length >= decl.init.properties.length * 0.8 &&
                                       decl.init.properties.length > 5;

            if (isNamespacePattern) {
              // Generate as static class with proper name
              const className = this._toPascalCase(varName);
              let code = this._indent(`public static class ${className}\n`);
              code += this._indent('{\n');
              this.indentLevel++;

              // Generate class content
              for (const prop of decl.init.properties) {
                const propName = prop.key && prop.key.name ? prop.key.name : 'Property';
                const propValue = prop.value;

                // Handle nested objects as nested static classes
                if (propValue.type === 'ObjectExpression') {
                  const nestedClass = this._toPascalCase(propName);
                  code += this._indent(`public static class ${nestedClass}\n`);
                  code += this._indent('{\n');
                  this.indentLevel++;

                  // Generate fields or methods for each property in the nested object
                  for (const nestedProp of propValue.properties) {
                    const fieldName = nestedProp.key && nestedProp.key.name ?
                      this._toPascalCase(nestedProp.key.name) : 'Field';
                    const nestedValue = nestedProp.value;

                    // Check if this is a function - generate as method using type map
                    if (nestedValue && (nestedValue.type === 'FunctionExpression' || nestedValue.type === 'ArrowFunctionExpression')) {
                      // For arrow functions on properties, JSDoc is attached to the property, not the value
                      if (nestedProp.leadingComments && (!nestedValue.leadingComments || nestedValue.leadingComments.length === 0)) {
                        nestedValue.leadingComments = nestedProp.leadingComments;
                      }

                      const typeInfo = this.typeMap.get(nestedValue);
                      const usesBigInteger = this._functionUsesBigInteger(nestedValue);
                      const usesArguments = this._usesArgumentsObject(nestedValue);
                      let params = nestedValue.params ?
                        nestedValue.params.map(param => {
                          const paramName = this._toCamelCase(param.name || 'param');
                          // FIRST: Check preComputedTypes from TypeAwareTranspiler
                          let paramType = null;
                          if (this.preComputedTypes && this.preComputedTypes.has(param)) {
                            const typeAnnotation = this.preComputedTypes.get(param);
                            if (typeAnnotation && typeAnnotation.type) {
                              paramType = this._typeObjectToCSharp(typeAnnotation.type);
                            }
                          }
                          // SECOND: Try JSDoc extraction
                          if (!paramType) {
                            paramType = this._extractJSDocParamType(nestedValue, param.name);
                          }
                          // THIRD: Fallback to inference
                          if (!paramType) {
                            paramType = usesBigInteger ? 'BigInteger' : this._inferCryptoParameterType(paramName);
                          }
                          return paramType + ' ' + paramName;
                        }).join(', ') : '';
                      // Add params array if function uses arguments object
                      if (usesArguments) {
                        params = params ? params + ', params object[] args' : 'params object[] args';
                      }

                      // FIRST: Check preComputedTypes for return type
                      let returnType = null;
                      if (this.preComputedTypes && this.preComputedTypes.has(nestedValue)) {
                        const funcTypeInfo = this.preComputedTypes.get(nestedValue);
                        if (funcTypeInfo && funcTypeInfo.type) {
                          const typeName = funcTypeInfo.type.name || funcTypeInfo.type;
                          // If type is Object, try to get tuple from JSDoc description
                          if (typeName === 'Object' || typeName === 'object') {
                            returnType = this._extractJSDocReturnType(nestedValue);
                          }
                          if (!returnType) {
                            returnType = this._typeObjectToCSharp(funcTypeInfo.type);
                          }
                        }
                      }
                      // SECOND: Try JSDoc extraction for tuple types
                      if (!returnType || returnType === 'object' || returnType === 'uint') {
                        const jsdocType = this._extractJSDocReturnType(nestedValue);
                        if (jsdocType && jsdocType.startsWith('(')) {
                          returnType = jsdocType;
                        }
                      }
                      // THIRD: Fallback to typeInfo from typeMap or BigInteger inference
                      if (!returnType) {
                        returnType = typeInfo?.returnType || (usesBigInteger ? 'BigInteger' : 'uint');
                      }
                      code += this._indent(`public static ${returnType} ${fieldName}(${params})\n`);
                      code += this._indent('{\n');
                      this.indentLevel++;

                      // Store parameter types in variableTypes for use in body generation
                      // This enables proper .Length vs .Count resolution for array parameters
                      if (nestedValue.params) {
                        nestedValue.params.forEach(param => {
                          const paramName = param.name || 'param';
                          let paramType = null;
                          if (this.preComputedTypes && this.preComputedTypes.has(param)) {
                            const typeAnnotation = this.preComputedTypes.get(param);
                            if (typeAnnotation && typeAnnotation.type) {
                              paramType = this._typeObjectToCSharp(typeAnnotation.type);
                            }
                          }
                          if (!paramType) {
                            paramType = this._extractJSDocParamType(nestedValue, paramName);
                          }
                          if (paramType) {
                            this.variableTypes.set(paramName, paramType);
                          }
                        });
                      }

                      if (nestedValue.body) {
                        // Pass return type in options for automatic casting in return statements
                        const bodyOptions = { ...options, returnType, isMethodBody: true };

                        // Arrow functions with implicit returns need special handling
                        if (nestedValue.type === 'ArrowFunctionExpression' && nestedValue.body.type !== 'BlockStatement') {
                          // Implicit return: body is an expression, wrap with return statement
                          const expr = this._generateNode(nestedValue.body, bodyOptions);
                          code += this._indent(`return ${expr};\n`);
                        } else {
                          // Regular function or arrow function with block statement
                          const body = this._generateNode(nestedValue.body, bodyOptions);
                          code += body || this._indent('return default;\n');
                        }
                      } else {
                        code += this._indent('return default;\n');
                      }

                      this.indentLevel--;
                      code += this._indent('}\n\n');
                    } else {
                      // Generate as field
                      const fieldValue = this._generateNode(nestedValue, options);
                      const fieldType = this._getNodeType(nestedValue, context);
                      code += this._indent(`public static ${fieldType} ${fieldName} = ${fieldValue};\n`);
                    }
                  }

                  this.indentLevel--;
                  code += this._indent('}\n\n');
                  continue;
                }

                // Handle functions as static methods or classes (for constructor patterns)
                if (propValue.type === 'FunctionExpression' || propValue.type === 'ArrowFunctionExpression') {
                  const methodName = this._toPascalCase(propName);

                  // Check if this is a constructor pattern (uses this.property = value)
                  if (this._isConstructorPattern(propValue)) {
                    // Generate as a nested class instead of static method
                    code += this._indent(`public class ${methodName}\n`);
                    code += this._indent('{\n');
                    this.indentLevel++;

                    // Extract all this.property = value assignments
                    const members = this._extractConstructorMembers(propValue);
                    const fields = members.filter(m => !m.isMethod);
                    const methods = members.filter(m => m.isMethod);

                    // Generate fields
                    for (const field of fields) {
                      const fieldName = this._toPascalCase(field.name);
                      // Use JSDoc @type annotation if available, otherwise infer from value
                      let fieldType = 'object';
                      if (field.jsdocType) {
                        fieldType = this._mapJSTypeToCSharp(field.jsdocType);
                      } else {
                        fieldType = this._inferTypeFromValue(field.valueNode) || 'object';
                      }
                      code += this._indent(`public ${fieldType} ${fieldName};\n`);
                    }

                    // Generate method fields (as delegates or separate methods)
                    for (const method of methods) {
                      const methodFieldName = this._toPascalCase(method.name);
                      // Infer delegate type from method signature
                      const methodNode = method.valueNode;
                      const methodParams = methodNode.params || [];
                      const paramTypes = methodParams.map(p => {
                        const paramName = p.name || 'arg';
                        return this._inferCryptoParameterType(paramName);
                      });

                      // Check return type from JSDoc (prefer captured jsdocReturns from statement)
                      let returnType = null;
                      if (method.jsdocReturns) {
                        returnType = this._mapJSTypeToCSharp(method.jsdocReturns);
                      } else {
                        returnType = this._extractJSDocReturnType(methodNode) || this._inferReturnTypeFromBody(methodNode);
                      }

                      if (returnType === 'void' || !returnType) {
                        if (paramTypes.length === 0) {
                          code += this._indent(`public Action ${methodFieldName};\n`);
                        } else {
                          code += this._indent(`public Action<${paramTypes.join(', ')}> ${methodFieldName};\n`);
                        }
                      } else {
                        if (paramTypes.length === 0) {
                          code += this._indent(`public Func<${returnType}> ${methodFieldName};\n`);
                        } else {
                          code += this._indent(`public Func<${paramTypes.join(', ')}, ${returnType}> ${methodFieldName};\n`);
                        }
                      }
                    }

                    if (fields.length > 0 || methods.length > 0) {
                      code += '\n';
                    }

                    // Generate constructor (all params optional to support new ClassName() calls)
                    const params = propValue.params ?
                      propValue.params.map(param => {
                        const paramName = this._toCamelCase(param.name || 'param');
                        let paramType = this._inferCryptoParameterType(paramName);
                        // Make params optional with default = null for reference types, 0 for value types
                        const isRefType = paramType.endsWith('[]') || paramType === 'string' || paramType === 'object';
                        if (isRefType) {
                          paramType = this._makeNullable(paramType, true);
                        }
                        const defaultValue = isRefType ? ' = null' : '';
                        return `${paramType} ${paramName}${defaultValue}`;
                      }).join(', ') : '';

                    code += this._indent(`public ${methodName}(${params})\n`);
                    code += this._indent('{\n');
                    this.indentLevel++;

                    // Generate constructor body - initialize fields and methods
                    if (propValue.body) {
                      const bodyOptions = { ...options, isConstructorBody: true, className: methodName };
                      const body = this._generateNode(propValue.body, bodyOptions);
                      code += body || '';
                    }

                    this.indentLevel--;
                    code += this._indent('}\n');

                    this.indentLevel--;
                    code += this._indent('}\n\n');
                    continue;
                  }

                  // Check for typeInfo metadata first (from AST preprocessing)
                  const typeInfo = propValue.typeInfo;

                  // Infer if function works with BigInteger based on body analysis
                  const usesBigInteger = this._functionUsesBigInteger(propValue);
                  const usesArguments = this._usesArgumentsObject(propValue);

                  // For arrow functions on properties, JSDoc is attached to the property, not the value
                  // Copy leadingComments from property to value if value lacks them
                  if (prop.leadingComments && (!propValue.leadingComments || propValue.leadingComments.length === 0)) {
                    propValue.leadingComments = prop.leadingComments;
                  }

                  let params = propValue.params ?
                    propValue.params.map(param => {
                      const paramName = this._toCamelCase(param.name || 'param');

                      // FIRST: Check preComputedTypes from TypeAwareTranspiler
                      let paramType = null;
                      if (this.preComputedTypes && this.preComputedTypes.has(param)) {
                        const typeAnnotation = this.preComputedTypes.get(param);
                        if (typeAnnotation && typeAnnotation.type) {
                          paramType = this._typeObjectToCSharp(typeAnnotation.type);
                        }
                      }
                      // SECOND: Use type from typeInfo if available
                      if (!paramType && typeInfo && typeInfo.params && typeInfo.params.has(param.name)) {
                        paramType = this._mapJSTypeToCSharp(typeInfo.params.get(param.name));
                      }
                      // THIRD: Extract from JSDoc on the function or property
                      if (!paramType) {
                        paramType = this._extractJSDocParamType(propValue, param.name);
                      }
                      // FOURTH: Fallback to inference
                      if (!paramType) {
                        paramType = usesBigInteger ? 'BigInteger' : this._inferCryptoParameterType(paramName);
                      }

                      return paramType + ' ' + paramName;
                    }).join(', ') : '';
                  // Add params array if function uses arguments object
                  if (usesArguments) {
                    params = params ? params + ', params object[] args' : 'params object[] args';
                  }

                  // FIRST: Check preComputedTypes for return type
                  let returnType = null;
                  if (this.preComputedTypes && this.preComputedTypes.has(propValue)) {
                    const funcTypeInfo = this.preComputedTypes.get(propValue);
                    if (funcTypeInfo && funcTypeInfo.type) {
                      const typeName = funcTypeInfo.type.name || funcTypeInfo.type;
                      // If type is Object, try to get tuple from JSDoc description
                      if (typeName === 'Object' || typeName === 'object') {
                        returnType = this._extractJSDocReturnType(propValue);
                      }
                      if (!returnType) {
                        returnType = this._typeObjectToCSharp(funcTypeInfo.type);
                      }
                    }
                  }
                  // SECOND: Try JSDoc extraction for tuple types and other explicit types
                  if (!returnType || returnType === 'object' || returnType === 'uint') {
                    const jsdocType = this._extractJSDocReturnType(propValue);
                    if (jsdocType) {
                      // Use JSDoc type for tuples, ulong, and other explicit types
                      returnType = jsdocType;
                    }
                  }
                  // THIRD: Use return type from typeInfo if available
                  if (!returnType && typeInfo && typeInfo.returns) {
                    returnType = this._mapJSTypeToCSharp(typeInfo.returns);
                  }
                  // FOURTH: Fallback to inference
                  if (!returnType) {
                    returnType = usesBigInteger ? 'BigInteger' : 'uint';
                  }

                  code += this._indent(`public static ${returnType} ${methodName}(${params})\n`);
                  code += this._indent('{\n');
                  this.indentLevel++;

                  // Store parameter types in variableTypes for use in body generation
                  // This enables proper .Length vs .Count resolution for array parameters
                  if (propValue.params) {
                    propValue.params.forEach(param => {
                      const paramName = param.name || 'param';
                      let paramType = null;
                      if (this.preComputedTypes && this.preComputedTypes.has(param)) {
                        const typeAnnotation = this.preComputedTypes.get(param);
                        if (typeAnnotation && typeAnnotation.type) {
                          paramType = this._typeObjectToCSharp(typeAnnotation.type);
                        }
                      }
                      if (!paramType && typeInfo && typeInfo.params && typeInfo.params.has(paramName)) {
                        paramType = this._mapJSTypeToCSharp(typeInfo.params.get(paramName));
                      }
                      if (!paramType) {
                        paramType = this._extractJSDocParamType(propValue, paramName);
                      }
                      if (paramType) {
                        this.variableTypes.set(paramName, paramType);
                      }
                    });
                  }

                  if (propValue.body) {
                    // Pass return type in options for automatic casting in return statements
                    // and for empty array type inference
                    const bodyOptions = { ...options, returnType, functionReturnType: returnType, isMethodBody: true };

                    // Arrow functions with implicit returns need special handling
                    if (propValue.type === 'ArrowFunctionExpression' && propValue.body.type !== 'BlockStatement') {
                      // Implicit return: body is an expression, wrap with return statement
                      const expr = this._generateNode(propValue.body, bodyOptions);
                      code += this._indent(`return ${expr};\n`);
                    } else {
                      // Regular function or arrow function with block statement
                      const body = this._generateNode(propValue.body, bodyOptions);
                      code += body || this._indent('return 0;\n');
                    }
                  } else {
                    code += this._indent('return 0;\n');
                  }

                  this.indentLevel--;
                  code += this._indent('}\n\n');
                  continue;
                }

                // Handle other property types as constants
                const constName = this._toPascalCase(propName);
                const constValue = this._generateNode(propValue, options);
                code += this._indent(`public static readonly object ${constName} = ${constValue};\n\n`);
              }

              this.indentLevel--;
              code += this._indent('}\n\n');
              return code;
            }
          }

          // Regular variable declaration
          // Check if we have a target type from the block pre-scan (variable later assigned to typed param)
          let targetTypeFromBlock = options.variableTargetTypes ?
            options.variableTargetTypes.get(varName) : null;

          // If initializing from array element access, infer type from array's element type
          if (!targetTypeFromBlock && decl.init && decl.init.type === 'MemberExpression' && decl.init.computed) {
            const arrayName = decl.init.object.name;
            if (arrayName) {
              const arrayType = this.variableTypes.get(arrayName) || this.preComputedTypes.get(arrayName);
              if (arrayType && arrayType.endsWith('[]')) {
                // Extract element type (e.g., 'byte[]' -> 'byte')
                targetTypeFromBlock = arrayType.slice(0, -2);
              }
            }
          }

          // Compute the inferred type BEFORE generating init, so we can pass it as expectedType
          // This is needed for ternary expressions to cast literal branches correctly
          const inferredType = targetTypeFromBlock || this._getNodeType(decl.init, context);

          // Pass inferred type as expectedType when generating init
          // Also mark this as a local variable initialization (cannot generate static classes)
          // Pass variableName for ES6 object literals with methods (to name the generated class)
          const initOptions = inferredType ?
            { ...options, expectedType: inferredType, isLocalVariableInit: true, variableName: varName } :
            { ...options, isLocalVariableInit: true, variableName: varName };
          let initValue = this._generateNode(decl.init, initOptions);

          // If inferredType is byte and initValue contains & 255 pattern, wrap in byte cast
          if (inferredType === 'byte' && (initValue.includes('& 255') || initValue.includes('& 0xFF')) && !initValue.startsWith('(byte)')) {
            initValue = `(byte)(${initValue})`;
          }

          const camelCaseVarName = this._toCamelCase(varName);

          // Track if this is a List<T> variable
          const isListInit = initValue && initValue.includes('new List<');
          if (isListInit) {
            this.listVariables.add(camelCaseVarName);
            // Extract actual List<T> type from initValue for pop() element type detection
            const listTypeMatch = initValue.match(/new List<([^>]+)>/);
            if (listTypeMatch) {
              this.variableTypes.set(varName, `List<${listTypeMatch[1]}>`);
            }
          }

          // Track variable type for type narrowing casts
          if (inferredType && varName && !isListInit) {
            this.variableTypes.set(varName, inferredType);
          }

          // For List<T> initializations, use var to let C# infer the correct type
          // This avoids mismatches when the return type context gives different element types
          if (isListInit) {
            return this._indent(`var ${camelCaseVarName} = ${initValue};\n`);
          }

          // For inline object class instantiations (ES6 objects with methods), use var
          // The class name starts with __ and was generated in _generateObjectExpression
          const isInlineObjectClass = initValue && initValue.startsWith('new __');
          if (isInlineObjectClass) {
            return this._indent(`var ${camelCaseVarName} = ${initValue};\n`);
          }

          // For slice/Skip/ToArray operations, use var to preserve array type
          const isSliceOperation = initValue && (
            initValue.includes('.ToArray()') ||
            initValue.includes('.Skip(') ||
            initValue.includes('.Concat(')
          );
          if (isSliceOperation && decl.init && decl.init.callee) {
            // Infer the array type from the source
            const sourceObj = decl.init.callee.object;
            if (sourceObj) {
              const sourceType = this._getNodeType(sourceObj, options);
              if (sourceType && sourceType.name && sourceType.name.endsWith('[]')) {
                this.variableTypes.set(varName, sourceType.name);
                return this._indent(`${sourceType.name} ${camelCaseVarName} = ${initValue};\n`);
              }
            }
            // Fallback to var for slice operations
            return this._indent(`var ${camelCaseVarName} = ${initValue};\n`);
          }

          // For tuple types (like from Split64), use var to let C# infer the complex type
          const isTupleType = inferredType && typeof inferredType === 'string' && inferredType.startsWith('(');
          if (isTupleType) {
            return this._indent(`var ${camelCaseVarName} = ${initValue};\n`);
          }

          // For calls to methods on static classes (like TranspilerTestCases.Split64),
          // use var since we can't reliably determine the return type
          const isStaticClassMethodCall = decl.init && decl.init.type === 'CallExpression' &&
            decl.init.callee && decl.init.callee.type === 'MemberExpression' &&
            decl.init.callee.object && decl.init.callee.object.type === 'Identifier' &&
            decl.init.callee.object.name && decl.init.callee.object.name[0] === decl.init.callee.object.name[0].toUpperCase() &&
            !this.variableTypes.has(decl.init.callee.object.name);
          if (isStaticClassMethodCall && inferredType === 'uint') {
            // The default type was returned, likely unknown - use var for safety
            // Mark this variable as potentially a tuple (for member access lowercase handling)
            this.variableTypes.set(varName, '(potential_tuple)');
            return this._indent(`var ${camelCaseVarName} = ${initValue};\n`);
          }

          // Type narrowing: if variable type is uint/ulong but init expression type is int/long,
          // add explicit cast
          const exprTypeForCast = this._getNodeType(decl.init, context);
          if (inferredType && exprTypeForCast) {
            const needsNarrowCast =
              (inferredType === 'uint' && (exprTypeForCast === 'int' || exprTypeForCast === 'long')) ||
              (inferredType === 'ulong' && (exprTypeForCast === 'int' || exprTypeForCast === 'uint' || exprTypeForCast === 'long')) ||
              (inferredType === 'byte' && (exprTypeForCast === 'int' || exprTypeForCast === 'uint')) ||
              (inferredType === 'ushort' && (exprTypeForCast === 'int' || exprTypeForCast === 'uint'));
            if (needsNarrowCast && !initValue.startsWith(`(${inferredType})`)) {
              initValue = `(${inferredType})(${initValue})`;
            }
          }

          if (node.kind === 'const') {
            const typeToUse = this._chooseVarOrType(inferredType);
            return this._indent(`${typeToUse} ${camelCaseVarName} = ${initValue};\n`);
          } else {
            // For let/var, use explicit type for non-trivial types when strict typing enabled
            const typeToUse = (this.options.useStrictTypes && inferredType && inferredType !== 'int' && inferredType !== 'object')
              ? inferredType
              : this._chooseVarOrType(inferredType);
            if (typeToUse !== 'var') {
              return this._indent(`${typeToUse} ${camelCaseVarName} = ${initValue};\n`);
            } else {
              return this._indent(`var ${camelCaseVarName} = ${initValue};\n`);
            }
          }
        } else {
          // Uninitialized variables get better default types
          const defaultType = this._getDefaultTypeForVariable(varName, context);
          const defaultValue = this._getDefaultValue(defaultType);
          // Track variable type for type narrowing casts
          if (defaultType && varName) {
            this.variableTypes.set(varName, defaultType);
          }
          return this._indent(`${defaultType} ${this._toCamelCase(varName)} = ${defaultValue};\n`);
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
          // FIRST: Check preComputedTypes for the variable identifier to get target type
          let inferredType = null;
          if (this.preComputedTypes && decl.id) {
            const typeAnnotation = this.preComputedTypes.get(decl.id);
            if (typeAnnotation && typeAnnotation.type) {
              inferredType = this._typeObjectToCSharp(typeAnnotation.type);
            }
          }
          // FALLBACK: Infer from expression (but don't use BigInteger unless explicit)
          if (!inferredType) {
            inferredType = this._getNodeType(decl.init, context);
            // Don't use BigInteger for 64-bit ops - use ulong instead
            if (inferredType === 'BigInteger' && !this._expressionIsExplicitBigInt(decl.init)) {
              inferredType = 'ulong';
            }
          }

          // Generate init value with type context for array creation
          // Also mark this as a local variable initialization (cannot generate static classes)
          let initValue = this._generateNode(decl.init, { ...options, isLocalVariableInit: true });

          // Fix array type mismatch: if variable type is T[] but init is new uint[n], fix it
          if (inferredType && inferredType.endsWith('[]')) {
            const elementType = inferredType.slice(0, -2);
            // Replace mismatched array types in initialization
            if (initValue.match(/^new \w+\[\d+\]$/)) {
              initValue = `new ${elementType}[${initValue.match(/\[(\d+)\]/)[1]}]`;
            }
          }

          // Type narrowing: if variable type is uint/ulong but init expression type is int/long,
          // add explicit cast
          let exprType = this._getNodeType(decl.init, context);
          let forceCast = false;

          // For binary expressions, C# type promotion rules produce signed types in most cases
          // Arithmetic operations (+ - * / %) on int operands produce int in C#, not uint
          // This means assigning to uint always requires a cast
          if (decl.init.type === 'BinaryExpression' && ['*', '+', '-', '/', '%'].includes(decl.init.operator)) {
            const unsignedTargets = ['uint', 'ulong', 'ushort', 'byte'];
            if (unsignedTargets.includes(inferredType)) {
              // Check if any operand is signed or could produce signed result
              const leftIsLiteral = decl.init.left.type === 'Literal' && typeof decl.init.left.value === 'number';
              const rightIsLiteral = decl.init.right.type === 'Literal' && typeof decl.init.right.value === 'number';
              const leftVarType = decl.init.left.type === 'Identifier' ? this.variableTypes.get(decl.init.left.name) : null;
              const rightVarType = decl.init.right.type === 'Identifier' ? this.variableTypes.get(decl.init.right.name) : null;

              // In C#, literal integers are int by default, so int * literal = int
              // Parameter types from JSDoc int32 are also int, so param * literal = int
              // Also handle case where both operands are int (param * param)
              // Basically any arithmetic with literals or int params produces int
              //
              // Also, if the expression type from _getNodeType is int/long, force the cast
              // This handles cases where inferred type shows the result is signed
              const hasSignedOperand = leftIsLiteral || rightIsLiteral ||
                                       leftVarType === 'int' || rightVarType === 'int' ||
                                       exprType === 'int' || exprType === 'long';
              if (hasSignedOperand) {
                forceCast = true;
                exprType = 'int';
              }
            }
          }

          if (inferredType && (exprType || forceCast)) {
            const needsCast = forceCast ||
              (inferredType === 'uint' && (exprType === 'int' || exprType === 'long')) ||
              (inferredType === 'ulong' && (exprType === 'int' || exprType === 'uint' || exprType === 'long')) ||
              (inferredType === 'byte' && (exprType === 'int' || exprType === 'uint')) ||
              (inferredType === 'ushort' && (exprType === 'int' || exprType === 'uint'));
            if (needsCast && !initValue.startsWith(`(${inferredType})`)) {
              initValue = `(${inferredType})(${initValue})`;
            }
          }

          // Track variable type for type narrowing casts
          if (inferredType && decl.id && decl.id.name) {
            this.variableTypes.set(decl.id.name, inferredType);
          }

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
    if (!varName || typeof varName !== 'string') {
      return context && context.isCryptographic ? 'uint' : 'int';
    }
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
    if (!methodName || typeof methodName !== 'string') {
      return 'Performs the operation';
    }
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
    if (!paramName || typeof paramName !== 'string') {
      return 'Parameter value';
    }
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
    if (!methodName || typeof methodName !== 'string') {
      return 'Method result';
    }
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
    if (!methodName || typeof methodName !== 'string') {
      return 'public';
    }
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
    if (!methodName || typeof methodName !== 'string') {
      return false;
    }
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
   * Note: This should use byte[] to match type inference in _inferTypeFromValue
   * @private
   */
  _generateArrayConstructorCall(args, options) {
    // Determine element type from context (expected type, return type) or default to byte
    let elementType = 'byte';
    let isJaggedArray = false; // e.g., uint[][] (array of arrays)
    const expectedType = options?.expectedType || options?.assignTargetType || options?.returnType;
    if (expectedType) {
      const typeName = typeof expectedType === 'string' ? expectedType :
                       expectedType.name || expectedType;
      if (typeName && typeName.endsWith('[][]')) {
        // Jagged array type like uint[][]
        elementType = typeName.slice(0, -4); // Extract base type from 'uint[][]' -> 'uint'
        isJaggedArray = true;
      } else if (typeName && typeName.endsWith('[]')) {
        elementType = typeName.slice(0, -2); // Extract element type from 'uint[]' -> 'uint'
      }
    }

    // Handle new Array(size) pattern
    if (args && !args.includes(',')) {
      // For jagged arrays: new uint[4][] (size in first dimension)
      if (isJaggedArray) {
        return `new ${elementType}[${args}][]`;
      }
      return `new ${elementType}[${args}]`;
    }

    // Handle new Array(element1, element2, ...) pattern
    if (args) {
      if (isJaggedArray) {
        return `new ${elementType}[][] { ${args} }`;
      }
      return `new ${elementType}[] { ${args} }`;
    }

    if (isJaggedArray) {
      return `new ${elementType}[0][]`;
    }
    return `new ${elementType}[0]`;
  }

  /**
   * Generate expression statement
   * @private
   */
  _generateExpressionStatement(node, options) {
    // Skip JavaScript-specific patterns that don't translate to C#

    // Skip "use strict" directive
    if (node.expression.type === 'Literal' && node.expression.value === 'use strict') {
      return '';
    }

    // Skip module.exports and global assignments
    if (node.expression.type === 'AssignmentExpression') {
      const left = node.expression.left;
      if (left.type === 'MemberExpression') {
        const objectName = left.object.name || '';
        const propertyName = left.property.name || '';

        // Skip: module.exports = ..., global.OpCodes = ..., exports.something = ...
        if (objectName === 'module' || objectName === 'global' || objectName === 'exports' || objectName === 'window') {
          return '';
        }
      }
    }

    const expr = this._generateNode(node.expression, options);
    return expr ? this._indent(expr + ';\n') : '';
  }

  /**
   * Generate return statement
   * @private
   */
  _generateReturnStatement(node, options) {
    if (node.argument) {
      // Check if returning an object literal - convert to ValueTuple
      if (node.argument.type === 'ObjectExpression' && node.argument.properties) {
        const props = node.argument.properties.map(prop => {
          const key = prop.key && prop.key.name ? prop.key.name : 'value';
          const value = this._generateNode(prop.value, options);
          return `${key}: ${value}`;
        });
        return this._indent(`return (${props.join(', ')});\n`);
      }

      // Check if returning a fixed-size array literal AND return type is tuple
      // Only convert to tuple if JSDoc specifies a tuple return type like (byte, byte)
      const returnTypeName = this._getTypeName(options?.returnType);
      if (node.argument.type === 'ArrayExpression' && node.argument.elements &&
          returnTypeName &&
          returnTypeName.startsWith('(') && returnTypeName.includes(',')) {
        // Return type is explicitly a tuple - generate ValueTuple syntax with casts
        // Parse tuple element types from return type like "(byte, byte)" -> ["byte", "byte"]
        const tupleTypes = returnTypeName
          .slice(1, -1) // Remove parentheses
          .split(',')
          .map(t => t.trim());

        const elements = node.argument.elements.map((element, index) => {
          if (!element) return '0';
          const elemCode = this._generateNode(element, options);
          const targetType = tupleTypes[index] || 'object';

          // Cast to target type
          // Check if already properly typed (literal value in range)
          if (element.type === 'Literal' && typeof element.value === 'number') {
            if (targetType === 'byte' && element.value >= 0 && element.value <= 255) {
              return `(byte)${elemCode}`;
            }
          }

          // Wrap complex expressions in cast
          if (element.type === 'BinaryExpression' || element.type === 'CallExpression') {
            return `(${targetType})(${elemCode})`;
          }

          // Default cast
          return `(${targetType})${elemCode}`;
        });

        return this._indent(`return (${elements.join(', ')});\n`);
      }

      let returnValue = this._generateNode(node.argument, options);

      // Handle List<T> to T[] conversion
      if (options && options.returnType && this._isArrayType(options.returnType)) {
        // Return type is an array
        // If returning a variable that was declared as List<T>, add .ToArray()
        if (node.argument.type === 'Identifier') {
          const varName = this._toCamelCase(node.argument.name);
          if (this.listVariables.has(varName)) {
            returnValue = `${returnValue}.ToArray()`;
          }
        }
      }

      // Add cast if return type is narrower than expression type
      if (options && options.returnType) {
        const needsCast = this._needsReturnCast(node.argument, options.returnType);
        if (needsCast) {
          // Check if it's a tuple return type
          const retTypeName = this._getTypeName(options.returnType);
          if (retTypeName && retTypeName.startsWith('(') && retTypeName.includes(',')) {
            // Already handled above for tuples
          } else if (retTypeName) {
            // Add cast for scalar types
            returnValue = `(${retTypeName})(${returnValue})`;
          }
        }
      }

      return this._indent('return ' + returnValue + ';\n');
    } else {
      return this._indent('return;\n');
    }
  }

  /**
   * Determine if a return value needs a cast based on the return type
   * @private
   */
  _needsReturnCast(argumentNode, returnType) {
    // Types that often need casts from wider or signed expressions
    const typesNeedingCasts = ['byte', 'sbyte', 'ushort', 'short', 'uint', 'int', 'ulong', 'long'];

    if (!typesNeedingCasts.includes(returnType)) {
      return false; // No cast needed for wide types or reference types
    }

    // Binary expressions often produce wider/signed types in C#
    if (argumentNode.type === 'BinaryExpression') {
      return true;
    }

    // Unary expressions with bitwise operators
    if (argumentNode.type === 'UnaryExpression' && ['~', '-', '+'].includes(argumentNode.operator)) {
      return true;
    }

    // Conditional expressions might need casts
    if (argumentNode.type === 'ConditionalExpression') {
      return true;
    }

    return false;
  }

  /**
   * Generate binary expression with cryptographic patterns
   * @private
   */
  _generateBinaryExpression(node, options) {
    // Handle typeof comparisons specially
    // JavaScript: typeof x === "string" or typeof x !== "string"
    // C#: x is string or !(x is string)
    if ((node.operator === '===' || node.operator === '==' ||
         node.operator === '!==' || node.operator === '!=') &&
        node.left.type === 'UnaryExpression' && node.left.operator === 'typeof' &&
        node.right.type === 'Literal' && typeof node.right.value === 'string') {
      const argument = this._generateNode(node.left.argument, options);
      const jsType = node.right.value;
      // Map JS typeof strings to C# type checks
      const typeCheckMap = {
        'string': 'string',
        'number': 'int', // or 'double' but int is more common in crypto
        'boolean': 'bool',
        'object': 'object',
        'undefined': 'null',
        'function': 'Delegate'
      };
      const csharpType = typeCheckMap[jsType] || jsType;
      const isNegated = node.operator === '!==' || node.operator === '!=';
      if (jsType === 'undefined') {
        return isNegated ? `${argument} != null` : `${argument} == null`;
      }
      return isNegated ? `!(${argument} is ${csharpType})` : `${argument} is ${csharpType}`;
    }

    let left = this._generateNode(node.left, options);
    let right = this._generateNode(node.right, options);
    let operator = node.operator;

    // C# operator precedence (lower number = higher precedence):
    // 1: Primary (., [], (), etc.)
    // 2: Unary (++, --, !, ~, etc.)
    // 3: Multiplicative (*, /, %)
    // 4: Additive (+, -)
    // 5: Shift (<<, >>)
    // 6: Relational (<, >, <=, >=)
    // 7: Equality (==, !=)
    // 8: Bitwise AND (&)
    // 9: Bitwise XOR (^)
    // 10: Bitwise OR (|)
    // 11: Logical AND (&&)
    // 12: Logical OR (||)
    const getOperatorPrecedence = (op) => {
      switch (op) {
        case '*': case '/': case '%': return 3;
        case '+': case '-': return 4;
        case '<<': case '>>': case '>>>': return 5;
        case '<': case '>': case '<=': case '>=': return 6;
        case '==': case '!=': case '===': case '!==': return 7;
        case '&': return 8;
        case '^': return 9;
        case '|': return 10;
        case '&&': return 11;
        case '||': return 12;
        default: return 99;
      }
    };

    // Wrap sub-expressions in parentheses if needed for correct precedence
    const currentPrecedence = getOperatorPrecedence(operator);
    if (node.left && node.left.type === 'BinaryExpression') {
      const leftPrecedence = getOperatorPrecedence(node.left.operator);
      // Need parens if left has LOWER precedence (higher number) than current
      if (leftPrecedence > currentPrecedence) {
        left = `(${left})`;
      }
    }
    if (node.right && node.right.type === 'BinaryExpression') {
      const rightPrecedence = getOperatorPrecedence(node.right.operator);
      // Need parens if right has LOWER OR EQUAL precedence for right-associative safety
      if (rightPrecedence >= currentPrecedence) {
        right = `(${right})`;
      }
    }

    // Check if operands are BigInteger
    const leftIsBigInt = left.includes('BigInteger') || left.includes('mask64') || left.includes('mask128');
    const rightIsBigInt = right.includes('BigInteger');

    // Get inferred types to detect narrow types
    let leftType = null;
    let rightType = null;
    if (this.preComputedTypes) {
      const leftInfo = this.preComputedTypes.get(node.left);
      const rightInfo = this.preComputedTypes.get(node.right);
      if (leftInfo && leftInfo.type) leftType = leftInfo.type;
      if (rightInfo && rightInfo.type) rightType = rightInfo.type;
    }
    // Also check variableTypes for identifier operands (e.g., parameters from JSDoc)
    if (!leftType && node.left && node.left.type === 'Identifier' && this.variableTypes) {
      const varType = this.variableTypes.get(node.left.name);
      if (varType) leftType = { name: varType };
    }
    if (!rightType && node.right && node.right.type === 'Identifier' && this.variableTypes) {
      const varType = this.variableTypes.get(node.right.name);
      if (varType) rightType = { name: varType };
    }

    const leftTypeName = leftType?.name || 'unknown';
    const rightTypeName = rightType?.name || 'unknown';
    const isLeftNarrow = ['uint8', 'int8', 'byte', 'sbyte'].includes(leftTypeName);
    const isLeftFloating = ['double', 'float64', 'float', 'float32'].includes(leftTypeName);

    // For shift operations, prepare shift amount as int
    if ((operator === '<<' || operator === '>>' || operator === '>>>')) {
      // If right operand involves BigInteger, we need to convert it to int
      if (rightIsBigInt) {
        // Extract the argument from new BigInteger(arg) or BigInteger.Parse("arg")
        let match = right.match(/new BigInteger\((.+)\)/);
        if (!match) {
          match = right.match(/BigInteger\.Parse\("(.+)"\)/);
          if (match && match[1]) {
            const parsedValue = match[1].replace(/^"|"$/g, '');
            if (parsedValue.match(/^\d+$/)) {
              right = parsedValue;
            } else {
              right = `(int)(BigInteger.Parse("${parsedValue}"))`;
            }
          }
        } else if (match && match[1]) {
          const stringLiteral = match[1];
          if (stringLiteral.match(/^"\d+"$/)) {
            right = stringLiteral.replace(/"/g, '');
          } else if (stringLiteral.match(/^\d+$/)) {
            right = stringLiteral;
          } else {
            right = `(int)(${stringLiteral})`;
          }
        } else {
          right = `(int)(${right})`;
        }
      } else if (!right.match(/^\d+$/)) {
        // C# shift operators require int, cast non-literal shift amounts
        right = `(int)(${right})`;
      }

      // If left operand is BigInteger, use native << and >> operators
      // BigInteger supports shift operators directly in C#
      if (leftIsBigInt) {
        this.usings.add('System.Numerics');
        // BigInteger << and >> work natively - no static method needed
        return `${left} ${operator === '>>>' ? '>>' : operator} ${right}`;
      }
    }

    // C# operators with crypto-specific handling
    switch (operator) {
      case '===':
        operator = '==';
        break;
      case '!==':
        operator = '!=';
        break;
      case '>>>': // Unsigned right shift - critical for crypto
        // Cast to uint to ensure result type is uint, not long
        // If left operand is floating point, cast to ulong first (JavaScript truncates to uint32)
        if (isLeftFloating) {
          return `(uint)(((ulong)(${left}) >> ${right}) & 0xFFFFFFFF)`;
        }
        return `(uint)((${left} >> ${right}) & 0xFFFFFFFF)`;
      case '<<': // Left shift
        // Cast to uint to ensure result type is uint, not long
        // If left operand is floating point, cast to ulong first
        if (isLeftFloating) {
          return `(uint)(((ulong)(${left}) << ${right}) & 0xFFFFFFFF)`;
        }
        return `(uint)((${left} << ${right}) & 0xFFFFFFFF)`;
      case '>>': // Right shift
        // If left operand is floating point, cast to long first
        if (isLeftFloating) {
          return `(long)(${left}) >> ${right}`;
        }
        return `${left} >> ${right}`;
      case '^': // XOR - very common in crypto
        return `${left} ^ ${right}`;
      case '&': // Bitwise AND
        // Cast floating point to ulong for bitwise ops (JS allows bitwise on floats via truncation)
        if (isLeftFloating) {
          // Cast to ulong, perform AND, and cast result back to uint (mask ensures it fits)
          return `(uint)((ulong)(${left}) & ${right})`;
        }
        // Remove noop masks on narrow types
        if (isLeftNarrow) {
          if (right === '0' || right === '0x00') {
            return '0'; // value & 0 = 0
          }
          if (right === '0xFF' || right === '0xff' || right === '255') {
            return left; // byte & 0xFF = byte (noop)
          }
        }
        if (right === '0' || right === '0x00') {
          return '0'; // any & 0 = 0
        }
        return `${left} & ${right}`;
      case '|': // Bitwise OR
        // In JavaScript, `value | 0` is an idiom to truncate to int32
        // For floating point operands, this is a conversion, not a noop
        if (right === '0' || right === '0x00') {
          if (isLeftFloating) {
            // JavaScript `double | 0` truncates to int32
            return `(int)(${left})`;
          }
          return left; // For integers, value | 0 = value (noop)
        }
        // For floating point left operand with non-zero right, cast to long first
        if (isLeftFloating) {
          return `(long)(${left}) | ${right}`;
        }
        return `${left} | ${right}`;
      case '||': // Logical OR - JS pattern for null coalescing with numbers
        // In JS, (x || 0) >>> 0 is common to ensure uint32 with default
        // In C#, numeric types are never null, so x || 0 just becomes x
        if (right === '0' || right === '0x00' || right === '0u' || right === '0L') {
          return left; // For numeric coalescing, just return left operand
        }
        // For actual boolean logic, keep ||
        return `${left} || ${right}`;
      case '&&': // Logical AND
        return `${left} && ${right}`;
    }

    return left + ' ' + operator + ' ' + right;
  }

  /**
   * Generate call expression with string method conversion
   * @private
   */
  _generateCallExpression(node, options) {
    // Detect IIFE (Immediately Invoked Function Expression) pattern
    // Pattern: (function(params) { body })(args) or ((params) => { body })(args)
    if (node.callee.type === 'FunctionExpression' || node.callee.type === 'ArrowFunctionExpression') {
      // This is an IIFE - convert to C# lambda expression with immediate invocation
      const returnType = options?.expectedType || options?.assignmentTargetType;
      const returnTypeName = returnType ? this._getTypeName(returnType) : 'object';

      // Generate lambda parameters
      const params = node.callee.params && node.callee.params.length > 0 ?
        node.callee.params.map(p => p.name).join(', ') : '';

      // Generate lambda body
      let body;
      if (node.callee.body.type === 'BlockStatement') {
        // _generateNode for BlockStatement returns statements without braces
        const bodyContent = this._generateNode(node.callee.body, options);
        body = `{ ${bodyContent} }`;
      } else {
        // Single expression body
        body = '{ return ' + this._generateNode(node.callee.body, options) + '; }';
      }

      // Generate arguments for invocation
      const args = node.arguments ?
        node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';

      // Return C# lambda: ((Func<ReturnType>)(() => { body }))()
      if (params) {
        return `((Func<${params}, ${returnTypeName}>)((${params}) => ${body}))(${args})`;
      } else {
        return `((Func<${returnTypeName}>)(() => ${body}))()`;
      }
    }

    // Handle this.method() calls
    // In constructor bodies, preserve this.MethodName(); in static methods, strip this.
    if (node.callee.type === 'MemberExpression' && node.callee.object.type === 'ThisExpression') {
      const methodName = this._toPascalCase(node.callee.property.name || node.callee.property);
      const args = node.arguments ?
        node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';

      // In constructor body context, preserve 'this.' prefix
      if (options && options.isConstructorBody) {
        return `this.${methodName}(${args})`;
      }

      // In static method context, just call without 'this.'
      return `${methodName}(${args})`;
    }

    // Handle String.fromCharCode(code) -> ((char)code).ToString()
    if (node.callee.type === 'MemberExpression' &&
        node.callee.object.type === 'Identifier' && node.callee.object.name === 'String' &&
        node.callee.property.name === 'fromCharCode') {
      const argCode = node.arguments && node.arguments.length > 0 ?
        this._generateNode(node.arguments[0], options) : '0';
      return `((char)(${argCode})).ToString()`;
    }

    // Generate arguments with type narrowing detection
    const args = node.arguments ?
      node.arguments.map(arg => {
        const argCode = this._generateNode(arg, options);
        // Detect byte masking pattern (& 255 or & 0xFF) and wrap in byte cast
        if ((argCode.includes('& 255') || argCode.includes('& 0xFF')) && !argCode.startsWith('(byte)')) {
          return `(byte)(${argCode})`;
        }
        return argCode;
      }).join(', ') : '';

    // Handle JavaScript BigInt() conversion -> C# BigInteger
    if (node.callee.type === 'Identifier' && (node.callee.name === 'BigInt' || node.callee.name === 'bigInt')) {
      // Check if argument is a hex string literal (e.g., "0xFFFFFFFFFFFFFFFF")
      if (args.match(/^"0x[0-9A-Fa-f]+"$/)) {
        // Extract hex value without 0x prefix and quotes
        const hexValue = args.replace(/^"0x/, '').replace(/"$/, '');
        // Use BigInteger.Parse with HexNumber style
        return `BigInteger.Parse("${hexValue}", System.Globalization.NumberStyles.HexNumber)`;
      }
      // Check if argument is a decimal string literal (e.g., "123")
      else if (args.match(/^"\d+"$/)) {
        // Extract the numeric value without quotes
        const numValue = args.replace(/"/g, '');
        // Use BigInteger.Parse for decimal strings
        return `BigInteger.Parse("${numValue}")`;
      }
      // For numeric literals without quotes, use new BigInteger
      else if (args.match(/^\d+$/)) {
        return `new BigInteger(${args})`;
      }
      // Check if argument is already a BigInteger (parameter or expression)
      // BigInteger doesn't have a copy constructor, so just return the value directly
      if (node.arguments && node.arguments.length === 1) {
        const argNode = node.arguments[0];
        const argType = this._getNodeType(argNode, { isCryptographic: true });
        if (argType === 'BigInteger' || argType === 'bigint') {
          return args; // Already BigInteger, no conversion needed
        }
        // For int types, cast to int (useful for BigInteger shift operations which need int)
        // In JavaScript, BigInt << BigInt requires BigInt on both sides
        // In C#, BigInteger << int requires int on the right side
        if (argType === 'int' || argType === 'int32' || argType === 'uint' ||
            argType === 'uint32' || argType === 'short' || argType === 'ushort' ||
            argType === 'byte' || argType === 'sbyte' || argType === 'long' || argType === 'ulong') {
          return `(int)(${args})`; // Cast to int for shift operations
        }
      }
      // For other expressions, use explicit cast to BigInteger
      return `(BigInteger)(${args})`;
    }

    // Handle JavaScript parseInt() conversion -> C# Convert.ToInt32()
    if (node.callee.type === 'Identifier' && node.callee.name === 'parseInt') {
      const argList = args.split(',').map(a => a.trim());
      if (argList.length === 2) {
        // parseInt(str, radix) -> Convert.ToInt32(str, radix)
        return `Convert.ToInt32(${argList[0]}, ${argList[1]})`;
      } else {
        // parseInt(str) -> Convert.ToInt32(str)
        return `Convert.ToInt32(${args})`;
      }
    }

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
      // JS substr(start, length) maps directly to C# Substring(start, length)
      if (propertyName === 'substr') {
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

      // Handle regex methods
      if (propertyName === 'test') {
        return `${object}.IsMatch(${args})`;
      }
      if (propertyName === 'exec') {
        return `${object}.Match(${args})`;
      }

      // Handle array methods
      if (propertyName === 'push') {
        // Get element type from the list variable if possible for narrowing cast
        const objectVarName = node.callee?.object?.name;
        let elementType = null;
        if (objectVarName && this.variableTypes.has(objectVarName)) {
          const listType = this.variableTypes.get(objectVarName);
          const match = listType?.match(/List<(\w+)>/);
          if (match) elementType = match[1];
        }
        // If pushing to a List with integral element type, cast argument appropriately
        const integralTypes = ['byte', 'sbyte', 'ushort', 'short', 'uint', 'ulong', 'int', 'long'];
        if (elementType && integralTypes.includes(elementType)) {
          // Always cast to target type for integral lists to avoid implicit conversion errors
          // Check if already cast (to avoid double casting)
          if (!args.startsWith(`(${elementType})`) && !args.startsWith(`(${elementType})(`) ) {
            return `${object}.Add((${elementType})(${args}))`;
          }
        }
        return `${object}.Add(${args})`; // Assumes List<T>
      }
      if (propertyName === 'pop') {
        // List<T> doesn't have Pop() - emulate with inline lambda
        // Get element type from the list variable if possible
        const objectVarName = node.callee?.object?.name;
        let elementType = 'uint';
        if (objectVarName && this.variableTypes.has(objectVarName)) {
          const listType = this.variableTypes.get(objectVarName);
          const match = listType?.match(/List<(\w+)>/);
          if (match) elementType = match[1];
        }
        return `((Func<${elementType}>)(() => { var __v = ${object}[${object}.Count - 1]; ${object}.RemoveAt(${object}.Count - 1); return __v; }))()`;
      }
      if (propertyName === 'concat') {
        // JS: arr.concat(other) returns a new array
        // C#: Concat returns IEnumerable<T>, need .ToArray()
        return `${object}.Concat(${args}).ToArray()`;
      }
      if (propertyName === 'slice') {
        // .slice() with no args is a copy operation -> ToArray()
        // .slice(n) skips first n elements -> Skip(n).ToArray()
        if (!args || args.trim() === '') {
          return `${object}.ToArray()`;
        }
        return `${object}.Skip(${args}).ToArray()`;
      }
      if (propertyName === 'fill') {
        // JS: array.fill(value) fills and returns the array
        // C#: Array.Fill is static void, so we need special handling
        // For new Array(n).fill(value) pattern, generate inline filled array
        const objectNode = node.callee.object;
        if (objectNode && objectNode.type === 'NewExpression') {
          // Check if this is new Array(n) pattern
          const calleeNode = objectNode.callee;
          if (calleeNode && calleeNode.type === 'Identifier' && calleeNode.name === 'Array') {
            // Pattern: new Array(8).fill(0) -> Enumerable.Repeat<T>((T)(0), 8).ToArray()
            const sizeArg = objectNode.arguments && objectNode.arguments.length > 0 ?
              this._generateNode(objectNode.arguments[0], options) : '0';
            const fillValue = args || '0';
            // Determine element type from context (expected type, return type) or default to byte
            let elementType = 'byte';
            const expectedType = options?.expectedType || options?.assignTargetType;
            if (expectedType) {
              const typeName = typeof expectedType === 'string' ? expectedType :
                               expectedType.name || expectedType;
              if (typeName && typeName.endsWith('[]')) {
                elementType = typeName.slice(0, -2); // Extract element type from 'uint[]' -> 'uint'
              }
            }
            return `Enumerable.Repeat<${elementType}>((${elementType})(${fillValue}), ${sizeArg}).ToArray()`;
          }
        }
        // For variable.fill(value), generate inline function that fills and returns
        return `((Func<byte[], byte[]>)(arr => { Array.Fill(arr, (byte)(${args})); return arr; }))(${object})`;
      }

      const property = node.callee.computed ?
        `[${this._generateNode(node.callee.property, options)}]` :
        `.${this._toPascalCase(propertyName)}`;

      // Handle console.log -> Console.WriteLine
      if (object === 'console' && (property === '.log' || property === '.Log')) {
        return `Console.WriteLine(${args})`;
      }

      // Handle OpCodes method calls with special formatting and type-specific handling (check all name variants)
      if (object === 'OpCodes' || object === 'opCodes') {
        return this._generateOpCodesCall(propertyName, args);
      }

      // Handle Array constructor calls with cryptographic context
      if (object === 'Array' || (object === 'new' && propertyName === 'Array')) {
        return this._generateArrayConstructorCall(args, options);
      }

      // Handle Math methods - cast arguments to double to avoid ambiguity
      if (object === 'Math') {
        const lowerName = propertyName.toLowerCase();
        const mathMethodsNeedingDouble = ['floor', 'ceil', 'round', 'sqrt', 'abs', 'sin', 'cos', 'tan', 'log', 'exp', 'pow'];
        if (mathMethodsNeedingDouble.includes(lowerName)) {
          // For methods like Math.floor, Math.ceil - cast argument to double
          const argList = args.split(',').map(a => a.trim());
          if (lowerName === 'pow' && argList.length === 2) {
            // Math.pow needs both args as double
            return `Math.Pow((double)(${argList[0]}), (double)(${argList[1]}))`;
          } else if (argList.length >= 1) {
            // For floor, ceil, round - cast result to uint for crypto code
            // These methods typically need integer results in crypto
            const mathCall = `Math.${this._toPascalCase(propertyName)}((double)(${argList[0]}))`;
            if (lowerName === 'floor' || lowerName === 'ceil' || lowerName === 'round') {
              return `(uint)(${mathCall})`;
            }
            return mathCall;
          }
        }
        // For Math.min, Math.max - keep as is (overloads for int exist)
        return `Math.${this._toPascalCase(propertyName)}(${args})`;
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
    let object = this._generateNode(node.object, options);

    // Check if object is a static class reference (identifier not in variableTypes and not a known variable)
    // In this case, convert to PascalCase since C# classes use PascalCase
    if (node.object.type === 'Identifier' && !this.variableTypes.has(node.object.name)) {
      // Check if this is NOT a function parameter or local variable
      const isLocalVar = options?.localVariables?.has(node.object.name);
      if (!isLocalVar) {
        // Likely a class/namespace reference - use PascalCase
        object = this._toPascalCase(node.object.name);
      }
    }

    // Handle 'this.' - preserve in constructor body, remove in static context
    if (node.object.type === 'ThisExpression' || object === '' || object === 'this') {
      const propertyName = node.property.name || node.property;
      const property = this._toPascalCase(propertyName);

      // In constructor body context, preserve 'this.' prefix
      if (options && options.isConstructorBody) {
        return `this.${property}`;
      }

      // In static method context, just return the property without 'this.'
      return property;
    }

    // Get the type of the object from preComputedTypes or variableTypes
    let objectType = null;
    if (this.preComputedTypes && node.object) {
      const typeInfo = this.preComputedTypes.get(node.object);
      if (typeInfo) {
        objectType = typeInfo.type;
      }
    }

    // Also check variableTypes for simple identifiers (e.g., function parameters)
    if (!objectType && node.object && node.object.type === 'Identifier') {
      const varName = node.object.name;
      const varType = this.variableTypes ? this.variableTypes.get(varName) : null;
      if (varType) {
        // variableTypes stores type names as strings like 'uint[]'
        objectType = { name: varType, isArray: varType.endsWith('[]') };
      }
    }

    const isArray = objectType && (
      objectType.isArray ||
      (typeof objectType.name === 'string' && objectType.name.endsWith('[]'))
    );

    if (node.computed) {
      // Array indexing
      const property = this._generateNode(node.property, options);

      // Only generate indexing if object is actually an array
      if (isArray || objectType === null) {
        // Allow if unknown (null) for backward compatibility
        return `${object}[${property}]`;
      } else {
        // Object is not an array - this might be an error in source
        // For now, generate the code but it will likely cause C# error
        return `${object}[${property}]`; // Will error in C# compiler, helping debug
      }
    } else {
      const propertyName = node.property.name || node.property;

      // Handle common array properties
      if (propertyName === 'length') {
        // Check if object is a List<T> type (use .Count)
        const isList = object.startsWith('List<') || object.includes('List<') ||
                       (objectType && objectType.name && objectType.name.includes('List'));
        if (isList) {
          return `${object}.Count`;
        }
        // Use .Length for arrays (ends with []) and strings
        const isString = objectType && objectType.name === 'string';
        if (isArray || isString) {
          return `${object}.Length`;
        }
        // For member expressions like this.X.length where X is a field,
        // use .Count since Lists are more common than arrays
        // Also check for common array-like variable names
        const lowerObject = object.toLowerCase();
        const isLikelyArray = lowerObject.endsWith('bytes') ||
                             lowerObject.endsWith('data') ||
                             lowerObject.includes('array') && !lowerObject.includes('bytearray');
        if (objectType === null) {
          // For this.ByteArray etc., use .Count since it's typically a List
          if (lowerObject.includes('bytearray') || lowerObject.includes('buffer')) {
            return `${object}.Count`;
          }
          // For clearly array-like names, use .Length
          if (isLikelyArray) {
            return `${object}.Length`;
          }
          // Default to .Count for unknown object types (safer for collections)
          return `${object}.Count`;
        }
        // Object is not array/string - use Count for collections
        return `${object}.Count`;
      }

      // Handle fill method on arrays
      if (propertyName === 'fill') {
        return `${object}.Fill`; // Will be handled in call expression
      }

      // Handle slice method
      if (propertyName === 'slice') {
        return `${object}.Skip`; // Will be converted to proper LINQ
      }

      // Check if object is a Dictionary type - use indexer syntax
      const isDictionary = objectType && typeof objectType.name === 'string' &&
        objectType.name.includes('Dictionary');
      if (isDictionary) {
        // Dictionary access uses indexer syntax: obj["propertyName"]
        // Need to cast to expected type since Dictionary<string, object> returns object
        return `(uint)${object}["${propertyName}"]`;
      }

      // Check if object is a tuple type - if so, keep property names lowercase (C# tuple field access)
      // Also check for (potential_tuple) marker from static class method calls
      const isTupleObject = objectType && typeof objectType.name === 'string' &&
        (objectType.name.startsWith('(') || objectType.name === '(potential_tuple)');
      if (isTupleObject) {
        // C# tuples use lowercase field names like (uint high32, uint low32)
        return `${object}.${propertyName}`;
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
    // Handle prototype method assignments: X.prototype.methodName = function() {...}
    // These should be stored and added to the nested class when it's output
    if (node.left && node.left.type === 'MemberExpression' &&
        node.left.object && node.left.object.type === 'MemberExpression' &&
        node.left.object.property && node.left.object.property.name === 'prototype') {
      // Extract class name and method name
      const className = node.left.object.object ?
        this._toPascalCase(node.left.object.object.name || 'UnknownClass') : 'UnknownClass';
      const methodName = node.left.property ?
        this._toPascalCase(node.left.property.name || 'UnknownMethod') : 'UnknownMethod';

      // Check if RHS is a function
      if (node.right && (node.right.type === 'FunctionExpression' || node.right.type === 'ArrowFunctionExpression')) {
        // Generate the method code
        const params = node.right.params ?
          node.right.params.map(param => {
            const paramName = this._toCamelCase(param.name || 'param');
            const paramType = this._inferCryptoParameterType(paramName);
            return `${paramType} ${paramName}`;
          }).join(', ') : '';

        const returnType = this._extractJSDocReturnType(node.right) || this._inferReturnTypeFromBody(node.right) || 'object';

        // Get field types for this class from nestedClasses
        let classFieldTypes = null;
        if (this.nestedClasses) {
          const nestedClass = this.nestedClasses.find(nc => nc.name === className);
          if (nestedClass && nestedClass.fieldTypes) {
            classFieldTypes = nestedClass.fieldTypes;
          }
        }

        let methodCode = `            public ${returnType} ${methodName}(${params})\n`;
        methodCode += `            {\n`;
        if (node.right.body) {
          const bodyOptions = { ...options, isConstructorBody: false, classFieldTypes: classFieldTypes };
          const body = this._generateNode(node.right.body, bodyOptions);
          // Indent the body properly
          const lines = body.split('\n').filter(line => line.trim());
          for (const line of lines) {
            methodCode += `                ${line.trim()}\n`;
          }
        }
        methodCode += `            }\n`;

        // Store the prototype method for later addition to the nested class
        if (!this.prototypeMethods) {
          this.prototypeMethods = new Map();
        }
        if (!this.prototypeMethods.has(className)) {
          this.prototypeMethods.set(className, []);
        }
        this.prototypeMethods.get(className).push(methodCode);

        // Return empty string - the method will be added to the class definition
        return '';
      }
    }

    const left = this._generateNode(node.left, options);
    const operator = node.operator;

    // Handle type narrowing casts - C# requires explicit casts for narrowing conversions
    // Get target type from LHS FIRST, before generating RHS
    let targetType = null;

    // For member expressions like arr[i], get the element type from the array variable
    if (node.left.type === 'MemberExpression' && node.left.computed) {
      // Get the array variable name
      const arrayVarName = node.left.object.type === 'Identifier' ? node.left.object.name : null;
      if (arrayVarName && this.variableTypes.has(arrayVarName)) {
        const arrayType = this.variableTypes.get(arrayVarName);
        // Extract element type from array type
        if (arrayType.endsWith('[]')) {
          targetType = arrayType.slice(0, -2); // byte[] -> byte
        }
      }
      // Fallback to preComputedTypes if variableTypes doesn't have it
      if (!targetType && this.preComputedTypes) {
        const objTypeInfo = this.preComputedTypes.get(node.left.object);
        if (objTypeInfo && objTypeInfo.type && objTypeInfo.type.elementType) {
          targetType = objTypeInfo.type.elementType.name;
        } else if (objTypeInfo && objTypeInfo.type) {
          // Infer element type from array type name
          const typeName = objTypeInfo.type.name;
          if (typeName === 'uint8[]' || typeName === 'byte[]') targetType = 'byte';
          else if (typeName === 'uint16[]' || typeName === 'ushort[]') targetType = 'ushort';
          else if (typeName === 'uint32[]' || typeName === 'uint[]') targetType = 'uint';
          else if (typeName === 'uint64[]' || typeName === 'ulong[]') targetType = 'ulong';
          else if (typeName === 'int8[]' || typeName === 'sbyte[]') targetType = 'sbyte';
          else if (typeName === 'int16[]' || typeName === 'short[]') targetType = 'short';
          else if (typeName === 'int32[]' || typeName === 'int[]') targetType = 'int';
          else if (typeName === 'int64[]' || typeName === 'long[]') targetType = 'long';
        }
      }
    } else if (node.left.type === 'MemberExpression' && !node.left.computed &&
               node.left.object && node.left.object.type === 'ThisExpression') {
      // Handle this.fieldName = value - look up field type from classFieldTypes
      const fieldName = node.left.property ? this._toPascalCase(node.left.property.name) : null;
      if (fieldName && options && options.classFieldTypes && options.classFieldTypes.has(fieldName)) {
        targetType = options.classFieldTypes.get(fieldName);
      }
    } else if (node.left.type === 'Identifier') {
      // Regular variable assignment - try variableTypes first
      const varName = node.left.name;
      if (this.variableTypes.has(varName)) {
        targetType = this.variableTypes.get(varName);
      }
      // Fallback to preComputedTypes
      if (!targetType && this.preComputedTypes) {
        const leftTypeInfo = this.preComputedTypes.get(node.left);
        if (leftTypeInfo && leftTypeInfo.type) {
          targetType = leftTypeInfo.type.name;
        }
      }
    }

    // Map JS type names to C# type names
    const typeNameToCSharp = {
      'uint8': 'byte', 'byte': 'byte',
      'uint16': 'ushort', 'ushort': 'ushort',
      'uint32': 'uint', 'uint': 'uint',
      'uint64': 'ulong', 'ulong': 'ulong',
      'int8': 'sbyte', 'sbyte': 'sbyte',
      'int16': 'short', 'short': 'short',
      'int32': 'int', 'int': 'int',
      'int64': 'long', 'long': 'long'
    };
    const csharpTargetType = typeNameToCSharp[targetType] || targetType;

    // Generate the right side AFTER determining target type
    // Pass assignTargetType so array initializers can use the correct element type
    const rightOptions = { ...options, assignTargetType: targetType };
    let right = this._generateNode(node.right, rightOptions);

    // Handle >>>= operator - C# requires shift count to be int, and convert to expanded form
    // for older C# versions that don't support >>>=
    if (operator === '>>>=') {
      // Convert x >>>= y to x = x >>> y (shift count should be int)
      return `${left} = ${left} >>> (int)(${right})`;
    }

    // Don't add type casts for shift assignment operators - shift count must be int
    const isShiftOperator = ['<<=', '>>='].includes(operator);

    // For narrow target types (byte, ushort, uint), ALWAYS add explicit cast
    // C# doesn't allow implicit narrowing conversions (but not for shift operations)
    const narrowTypes = ['byte', 'sbyte', 'ushort', 'short', 'uint'];
    if (!isShiftOperator && csharpTargetType && narrowTypes.includes(csharpTargetType)) {
      // Check if the right side is already properly typed (avoid double casts)
      const hasCast = new RegExp(`^\\(${csharpTargetType}\\)`).test(right);
      if (!hasCast && !right.startsWith(`(${csharpTargetType})(`) && right !== '0' && right !== 'null') {
        // Wrap the entire RHS in a cast
        right = `(${csharpTargetType})(${right})`;
      }
    }

    return left + ' ' + operator + ' ' + right;
  }

  /**
   * Generate identifier
   * @private
   */
  _generateIdentifier(node, options) {
    // Handle JavaScript undefined -> C# null
    if (node.name === 'undefined') {
      return 'null';
    }

    // Remove 'this' in static method contexts
    // All generated methods in OpCodes are static, so 'this' is invalid
    if (node.name === 'this') {
      // In static context, 'this' is an error - remove it
      // This typically appears in patterns like 'this.method()' which becomes just 'method()'
      // The member expression handler will deal with the full 'this.x' pattern
      return ''; // Return empty string, will be handled by parent expression
    }

    // Preserve global objects that should remain PascalCase in C#
    const globalObjects = new Set([
      'Math', 'Array', 'Object', 'String', 'Number', 'Boolean',
      'Date', 'RegExp', 'Error', 'JSON', 'Console',
      'OpCodes' // Self-reference to the OpCodes class
    ]);

    if (globalObjects.has(node.name)) {
      return node.name; // Keep original casing
    }

    // Handle 'arguments' special JS object - C# doesn't have this
    // This typically appears in variadic functions; should be transformed earlier
    if (node.name === 'arguments') {
      // Return a placeholder - the containing function needs to use 'params' array
      return 'args'; // Assumes the function has been updated to use params object[] args
    }

    // Apply AlgorithmFramework mapping for class names
    const mappedName = this._mapAlgorithmFrameworkClass(node.name);

    // Check if this looks like a class/type name (starts with uppercase)
    // and is NOT a known local variable - if so, keep PascalCase
    const startsWithUppercase = mappedName.length > 0 && mappedName[0] === mappedName[0].toUpperCase() && mappedName[0] !== mappedName[0].toLowerCase();
    if (startsWithUppercase && !this.variableTypes.has(mappedName)) {
      // Likely a class/type reference - use PascalCase
      return this._toPascalCase(mappedName);
    }

    return this._toCamelCase(mappedName);
  }

  /**
   * Generate literal
   * @private
   */
  _generateLiteral(node, options) {
    // Handle JavaScript regex literals -> C# Regex
    if (node.regex) {
      this.usings.add('System.Text.RegularExpressions');
      const pattern = node.regex.pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const flags = node.regex.flags || '';

      // Convert JavaScript regex flags to C# RegexOptions
      let regexOptions = [];
      if (flags.includes('i')) regexOptions.push('RegexOptions.IgnoreCase');
      if (flags.includes('m')) regexOptions.push('RegexOptions.Multiline');
      if (flags.includes('s')) regexOptions.push('RegexOptions.Singleline');

      if (regexOptions.length > 0) {
        return `new Regex("${pattern}", ${regexOptions.join(' | ')})`;
      } else {
        return `new Regex("${pattern}")`;
      }
    }

    // Handle JavaScript undefined -> C# null (undefined is parsed as Literal with no value)
    if (node.value === undefined && (node.raw === 'undefined' || node.name === 'undefined')) {
      return 'null';
    }

    if (typeof node.value === 'string') {
      return '"' + node.value.replace(/"/g, '\\"') + '"';
    } else if (node.value === null) {
      return 'null';
    } else if (typeof node.value === 'boolean') {
      return node.value ? 'true' : 'false';
    } else if (node.value === undefined) {
      // Fallback: any other undefined value becomes null
      return 'null';
    } else if (typeof node.value === 'bigint') {
      // Handle JavaScript BigInt literals -> C# BigInteger
      this.usings.add('System.Numerics');
      const bigintStr = node.value.toString();
      return `BigInteger.Parse("${bigintStr}")`;
    } else if (typeof node.value === 'number') {
      // Handle large integer literals that exceed C# int/long range
      const MAX_INT = 2147483647;
      const MAX_UINT = 4294967295;
      const MAX_LONG = 9223372036854775807;
      const MAX_ULONG = 18446744073709551615;

      // JavaScript loses precision above 2^53, so use string comparison for very large numbers
      const nodeValueStr = node.value.toString();
      const isTooLargeForUlong = node.value > MAX_ULONG ||
                                  (nodeValueStr.length > 19) || // More than 19 digits = > 2^64
                                  (nodeValueStr === '18446744073709551616'); // Exactly 2^64

      if (isTooLargeForUlong) {
        // Use BigInteger.Parse for very large numbers (>= 2^64)
        this.usings.add('System.Numerics');
        return `BigInteger.Parse("${nodeValueStr}")`;
      } else if (node.value > MAX_LONG && node.value <= MAX_ULONG) {
        // Use UL suffix for unsigned long literals
        return `${Math.floor(node.value)}UL`;
      } else if (node.value > MAX_UINT && node.value <= MAX_LONG) {
        // Values > MAX_UINT (4294967295) need to be long literals
        return `${Math.floor(node.value)}L`;
      } else if (node.value > MAX_INT && node.value <= MAX_UINT) {
        // Values > MAX_INT (2147483647) but <= MAX_UINT need uint suffix
        return `${Math.floor(node.value)}u`;
      } else {
        return String(node.value);
      }
    } else {
      return String(node.value);
    }
  }

  /**
   * Check if an AST node produces a boolean expression in C#
   * @private
   */
  _isBooleanExpression(node) {
    if (!node) return false;

    switch (node.type) {
      case 'BinaryExpression':
        // Comparison operators produce boolean
        return ['==', '!=', '===', '!==', '<', '>', '<=', '>='].includes(node.operator);
      case 'LogicalExpression':
        // && and || produce boolean
        return true;
      case 'UnaryExpression':
        // ! produces boolean
        return node.operator === '!';
      case 'Literal':
        // Boolean literals
        return typeof node.value === 'boolean';
      case 'CallExpression':
        // Some method calls return boolean - check common patterns
        if (node.callee && node.callee.property) {
          const methodName = node.callee.property.name || '';
          const booleanMethods = ['hasMoreBits', 'contains', 'includes', 'startsWith',
                                   'endsWith', 'has', 'is', 'equals', 'test'];
          return booleanMethods.some(m => methodName.toLowerCase().includes(m.toLowerCase()));
        }
        return false;
      case 'Identifier':
        // Check if this identifier has a boolean type from preComputedTypes or variableTypes
        if (node.name) {
          // Check variableTypes first
          if (this.variableTypes.has(node.name)) {
            const varType = this.variableTypes.get(node.name);
            return varType === 'bool' || varType === 'boolean';
          }
          // Check preComputedTypes
          if (this.preComputedTypes && this.preComputedTypes.has(node)) {
            const typeInfo = this.preComputedTypes.get(node);
            if (typeInfo && typeInfo.type) {
              const typeName = typeInfo.type.name || typeInfo.type;
              return typeName === 'bool' || typeName === 'boolean';
            }
          }
        }
        return false;
      default:
        return false;
    }
  }

  /**
   * Ensure an expression is boolean for C# conditionals
   * @private
   */
  _ensureBooleanExpression(node, generatedCode, options) {
    // If already a boolean expression, return as-is
    if (this._isBooleanExpression(node)) {
      return generatedCode;
    }

    // If the generated code already has comparison operators, return as-is
    // Note: Check for actual comparison operators, not bitwise operators
    const hasComparison = /(?:^|[^=!<>])([=!<>]=|[<>])(?![=<>])/.test(generatedCode) ||
                          generatedCode.includes(' == ') || generatedCode.includes(' != ') ||
                          generatedCode.includes(' < ') || generatedCode.includes(' > ') ||
                          generatedCode.includes(' <= ') || generatedCode.includes(' >= ');
    if (hasComparison) {
      return generatedCode;
    }

    // If it's a boolean literal, return as-is
    if (generatedCode === 'true' || generatedCode === 'false') {
      return generatedCode;
    }

    // If it looks like a null/zero check already, return as-is
    if (generatedCode.includes('!= null') || generatedCode.includes('== null') ||
        generatedCode.includes('!= 0') || generatedCode.includes('== 0')) {
      return generatedCode;
    }

    // For numeric/other expressions, add != 0 comparison
    // Always wrap in parentheses to ensure correct precedence
    return `(${generatedCode}) != 0`;
  }

  /**
   * Generate if statement
   * @private
   */
  _generateIfStatement(node, options) {
    // Skip module.exports and typeof checks (JavaScript-specific module code)
    if (node.test && node.test.type === 'LogicalExpression') {
      const testStr = JSON.stringify(node.test);
      if (testStr.includes('"module"') || testStr.includes('"exports"') ||
          testStr.includes('"typeof"') || testStr.includes('"undefined"')) {
        return ''; // Skip this entire if statement
      }
    }

    let code = '';
    let test = this._generateNode(node.test, options);

    // Ensure the test expression is boolean for C#
    test = this._ensureBooleanExpression(node.test, test, options);

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
    let test = this._generateNode(node.test, options);

    // Ensure the test expression is boolean for C#
    test = this._ensureBooleanExpression(node.test, test, options);

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
    let test = this._generateNode(node.test, options);
    // Ensure the test expression is boolean for C#
    test = this._ensureBooleanExpression(node.test, test, options);
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
    const operator = node.operator;

    // Handle ~~ (double tilde) idiom: JavaScript truncation to int32
    // Pattern: UnaryExpression(~, UnaryExpression(~, argument))
    if (operator === '~' && node.argument &&
        node.argument.type === 'UnaryExpression' && node.argument.operator === '~') {
      // ~~x in JavaScript converts to int32, equivalent to C# (int)x
      const innerArg = this._generateNode(node.argument.argument, options);
      return `(int)(${innerArg})`;
    }

    // Handle !! (double negation) idiom: JavaScript conversion to boolean
    // Pattern: UnaryExpression(!, UnaryExpression(!, argument))
    if (operator === '!' && node.argument &&
        node.argument.type === 'UnaryExpression' && node.argument.operator === '!') {
      // !!x in JavaScript converts to boolean
      const innerArg = this._generateNode(node.argument.argument, options);
      // If argument is already boolean, just return it
      if (this._isBooleanExpression(node.argument.argument)) {
        return innerArg;
      }
      // For numbers, check != 0
      // For objects/arrays/strings, check != null
      let argType = this._getNodeType(node.argument.argument, {});
      // Also check variableTypes for identifiers
      if (node.argument.argument.type === 'Identifier') {
        const varType = this.variableTypes.get(node.argument.argument.name);
        if (varType) argType = varType;
      }
      // For object type parameters and reference types, use != null
      // Numeric types and their unsigned variants use != 0
      const numericTypes = ['int', 'uint', 'byte', 'sbyte', 'short', 'ushort', 'long', 'ulong', 'float', 'double', 'decimal'];
      if (argType && numericTypes.includes(argType)) {
        return `(${innerArg} != 0)`;
      }
      // For object, string, array types, check against null
      return `(${innerArg} != null)`;
    }

    const argument = this._generateNode(node.argument, options);

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
        // In JavaScript, !x means "x is falsy" (null/undefined/0/false/empty)
        // In C#, we need proper boolean conversion
        // If argument is already boolean, use !
        // If it's an object/array type, use == null
        // If it's a number type, use == 0
        if (this._isBooleanExpression(node.argument)) {
          return `!${argument}`;
        }
        // For arrays/objects, check for null
        if (argument.includes('[]') || argument.includes('Array') ||
            argument.includes('List<') || argument.endsWith('.Length')) {
          return `${argument} == null`;
        }
        // For numbers, check for 0
        return `${argument} == 0`;
      case '-': // Unary minus
        return `-${argument}`;
      case '+': // Unary plus (JavaScript conversion to number)
        // In JavaScript, +str converts string to number
        // In C#, we need explicit parsing
        // Check if argument is a string type
        let argTypeForPlus = null;
        // Check variableTypes first (parameters and locals)
        if (node.argument.type === 'Identifier') {
          argTypeForPlus = this.variableTypes.get(node.argument.name);
        }
        // Fall back to general type inference
        if (!argTypeForPlus) {
          argTypeForPlus = this._getNodeType(node.argument, {});
        }
        // Check preComputedTypes if still not found
        if ((!argTypeForPlus || argTypeForPlus === 'object' || argTypeForPlus === 'uint') && node.argument.type === 'Identifier' && this.preComputedTypes) {
          for (const [astNode, typeInfo] of this.preComputedTypes) {
            if (astNode.type === 'Identifier' && astNode.name === node.argument.name && typeInfo?.type) {
              argTypeForPlus = this._typeObjectToCSharp(typeInfo.type);
              break;
            }
          }
        }
        if (argTypeForPlus === 'string') {
          return `double.Parse(${argument})`;
        }
        // For numeric types, unary + is a no-op, but C# doesn't support it
        // Just return the argument without the operator
        return argument;
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
        // In JS, (x || 0) >>> 0 is common to ensure uint32 with default
        // In C#, numeric types are never null/undefined, so x || 0 just becomes x
        if (right === '0' || right === '0u' || right === '0L' || right === '0x00') {
          return left; // For numeric coalescing, just return left operand
        }
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
    let test = this._generateNode(node.test, options);

    // Try to infer type from BOTH branches first
    const consequentType = this._inferNodeType(node.consequent, options);
    const alternateType = this._inferNodeType(node.alternate, options);

    // Generate branches with inferred type context
    let consequent = this._generateNode(node.consequent, options);
    let alternate = this._generateNode(node.alternate, options);

    // Ensure the test expression is boolean for C#
    test = this._ensureBooleanExpression(node.test, test, options);

    // Handle literal type mismatches in ternary
    // Infer target type from branches or fall back to expected type
    let targetType = null;

    // If one branch is typed and the other is a literal, use the typed branch's type
    if (consequentType && consequentType !== 'object' && consequentType !== 'int') {
      targetType = consequentType;
    } else if (alternateType && alternateType !== 'object' && alternateType !== 'int') {
      targetType = alternateType;
    } else {
      // Fall back to expected type from context
      const expectedType = options?.expectedType || options?.assignmentTargetType;
      if (expectedType) {
        targetType = this._getTypeName(expectedType);
      }
    }

    // Apply casts to literal 0 if needed
    if (targetType && ['uint', 'ushort', 'ulong', 'byte', 'sbyte', 'short', 'long'].includes(targetType)) {
      if (alternate === '0') {
        alternate = `(${targetType})(0)`;
      }
      if (consequent === '0') {
        consequent = `(${targetType})(0)`;
      }
    }

    return test + ' ? ' + consequent + ' : ' + alternate;
  }

  /**
   * Generate array expression with cryptographic context
   * @private
   */
  _generateArrayExpression(node, options) {
    // Check if we have an expected type from context (e.g., return type, assignment target)
    let arrayElementType = null;
    let isJaggedArray = false;
    const expectedType = options?.expectedType || options?.returnType;
    if (expectedType) {
      const typeName = this._getTypeName(expectedType);
      if (typeName && typeName.endsWith('[][]')) {
        // Jagged array: uint[][] -> element type is uint[], base type is uint
        arrayElementType = typeName.slice(0, -4); // Extract base type from 'uint[][]' -> 'uint'
        isJaggedArray = true;
      } else if (typeName && typeName.endsWith('[]')) {
        arrayElementType = typeName.slice(0, -2); // Extract element type from 'byte[]' -> 'byte'
      }
    }

    if (!node.elements || node.elements.length === 0) {
      // Empty arrays are dynamically built up with push(), so use List
      // Use expected type from context if available
      // If no explicit expected type, try to infer from preComputedTypes
      let elementType = arrayElementType;
      if (!elementType && this.preComputedTypes) {
        const preComputed = this.preComputedTypes.get(node);
        if (preComputed?.type) {
          const typeStr = this._typeObjectToCSharp(preComputed.type);
          if (typeStr && typeStr.endsWith('[]')) {
            elementType = typeStr.slice(0, -2);
          }
        }
      }
      // Try to infer from function return type if available
      if (!elementType && options?.functionReturnType) {
        const returnTypeStr = this._getTypeName(options.functionReturnType);
        if (returnTypeStr && returnTypeStr.endsWith('[]')) {
          elementType = returnTypeStr.slice(0, -2);
        }
      }
      // Fall back to byte if still no type found
      elementType = elementType || 'byte';
      if (isJaggedArray) {
        return `new List<${elementType}[]>()`;
      }
      return `new List<${elementType}>()`;
    }

    // Generate elements with appropriate casts if element type is known
    // For jagged arrays, pass inner element type to nested array elements
    const innerOptions = isJaggedArray ? { ...options, expectedType: `${arrayElementType}[]` } : options;
    const elements = node.elements.map(element => {
      if (!element) return '0';
      const elemCode = this._generateNode(element, innerOptions);

      // If we know the target element type and it's different from what would be inferred,
      // add an explicit cast
      const needsCastTypes = ['byte', 'sbyte', 'ushort', 'short', 'uint', 'ulong', 'int', 'long'];
      if (arrayElementType && !isJaggedArray && needsCastTypes.includes(arrayElementType)) {
        // For integral types, expressions often need casts due to C# type promotion rules
        if (element.type === 'BinaryExpression' || element.type === 'CallExpression' ||
            element.type === 'UnaryExpression' || element.type === 'ConditionalExpression') {
          return `(${arrayElementType})(${elemCode})`;
        }
        // For identifiers and member expressions, check if already the right type
        if (element.type === 'Identifier' || element.type === 'MemberExpression') {
          // Skip cast if element is already an array access or likely the right type
          return elemCode;
        }
        // Literals may need casts too
        if (element.type === 'Literal' && typeof element.value === 'number') {
          return `(${arrayElementType})(${elemCode})`;
        }
        return elemCode;
      }
      return elemCode;
    }).join(', ');

    // Use expected type if available
    if (isJaggedArray) {
      return `new ${arrayElementType}[][] { ${elements} }`;
    }
    if (arrayElementType) {
      return `new ${arrayElementType}[] { ${elements} }`;
    }

    // Infer array type from elements
    const context = { isCryptographic: true };
    const firstElement = node.elements.find(el => el !== null && el !== undefined);
    if (firstElement) {
      const elementType = this._getNodeType(firstElement, context);
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

    // Default for crypto algorithms - non-empty arrays use fixed arrays
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

    // Check if this is an object-as-namespace pattern OR an object with methods
    // Can have all functions, or mix of functions and nested objects (also namespaces)
    // Also check for method shorthand syntax (prop.method === true)
    const functionProps = node.properties.filter(prop =>
      prop.method === true || (prop.value && (
        prop.value.type === 'FunctionExpression' ||
        prop.value.type === 'ArrowFunctionExpression'
      ))
    );

    const objectProps = node.properties.filter(prop =>
      prop.value && prop.value.type === 'ObjectExpression'
    );

    // If object has ANY functions, we need to generate it as a class (can't put functions in dict)
    const hasAnyFunctions = functionProps.length > 0;

    // For namespace patterns (large objects with many functions), generate as static class
    const hasManyFunctionsOrObjects = (functionProps.length + objectProps.length) >= node.properties.length * 0.5;
    const isNamespacePattern = hasAnyFunctions && (node.properties.length >= 3 || hasManyFunctionsOrObjects);

    // If we're in a variable assignment context (local variable), we can't generate a static class
    // Instead, generate a comment noting the limitation and use an anonymous object
    const isLocalContext = options && options.isLocalVariableInit;

    if (isNamespacePattern && !isLocalContext) {

      // This is an OpCodes-style object-as-namespace
      // Generate as a static class with static methods and nested classes
      let code = 'public static class GeneratedNamespace\n{\n';
      this.indentLevel++;

      for (const prop of node.properties) {
        const propName = prop.key && prop.key.name ? prop.key.name : 'Property';
        const propValue = prop.value;

        // Handle nested objects as nested static classes
        if (propValue.type === 'ObjectExpression') {
          const nestedClass = this._toPascalCase(propName);
          code += this._indent(`public static class ${nestedClass}\n`);
          code += this._indent('{\n');
          this.indentLevel++;

          // Generate nested object (recursively)
          const nestedCode = this._generateObjectExpression(propValue, options);
          // Strip the outer "public static class" wrapper since we already added it
          if (nestedCode.startsWith('public static class')) {
            // Extract the content between the outer braces
            const startIdx = nestedCode.indexOf('{');
            const endIdx = nestedCode.lastIndexOf('}');
            if (startIdx >= 0 && endIdx > startIdx) {
              code += nestedCode.substring(startIdx + 1, endIdx);
            }
          } else {
            code += this._indent(nestedCode + '\n');
          }

          this.indentLevel--;
          code += this._indent('}\n\n');
          continue;
        }

        // Handle functions as static methods or classes (for constructor patterns)
        // Also handle method shorthand syntax (prop.method === true)
        if (prop.method === true || propValue.type === 'FunctionExpression' || propValue.type === 'ArrowFunctionExpression') {
          const methodName = this._toPascalCase(propName);

          // Check if this is a constructor pattern (uses this.property = value)
          if (this._isConstructorPattern(propValue)) {
            // Generate as a nested class instead of static method
            code += this._indent(`public class ${methodName}\n`);
            code += this._indent('{\n');
            this.indentLevel++;

            // Extract all this.property = value assignments
            const members = this._extractConstructorMembers(propValue);
            const fields = members.filter(m => !m.isMethod);
            const methods = members.filter(m => m.isMethod);

            // Generate fields
            for (const field of fields) {
              const fieldName = this._toPascalCase(field.name);
              const fieldType = this._inferTypeFromValue(field.valueNode) || 'object';
              code += this._indent(`public ${fieldType} ${fieldName};\n`);
            }

            // Generate method fields (as delegates or separate methods)
            for (const method of methods) {
              const methodFieldName = this._toPascalCase(method.name);
              code += this._indent(`public Action ${methodFieldName};\n`);
            }

            if (fields.length > 0 || methods.length > 0) {
              code += '\n';
            }

            // Generate constructor
            const params = propValue.params ?
              propValue.params.map(param => {
                const paramName = this._toCamelCase(param.name || 'param');
                const paramType = this._inferCryptoParameterType(paramName);
                return `${paramType} ${paramName}`;
              }).join(', ') : '';

            code += this._indent(`public ${methodName}(${params})\n`);
            code += this._indent('{\n');
            this.indentLevel++;

            // Generate constructor body - initialize fields
            if (propValue.body) {
              const bodyOptions = { ...options, isConstructorBody: true };
              const body = this._generateNode(propValue.body, bodyOptions);
              code += body || '';
            }

            this.indentLevel--;
            code += this._indent('}\n');

            this.indentLevel--;
            code += this._indent('}\n\n');
            continue;
          }

          // Check for typeInfo metadata first (from AST preprocessing)
          const typeInfo = propValue.typeInfo;

          // Infer if function works with BigInteger based on body analysis
          const usesBigInteger = this._functionUsesBigInteger(propValue);
          const usesArguments = this._usesArgumentsObject(propValue);

          // Generate static method
          let params = propValue.params ?
            propValue.params.map(param => {
              const paramName = this._toCamelCase(param.name || 'param');

              // Use type from typeInfo if available, otherwise infer
              let paramType;
              if (typeInfo && typeInfo.params && typeInfo.params.has(param.name)) {
                paramType = this._mapJSTypeToCSharp(typeInfo.params.get(param.name));
                if (methodName === 'RotL8' || methodName === 'RotR8') {
                  console.error(`  ${param.name} type from JSDoc:`, typeInfo.params.get(param.name), '→', paramType);
                }
              } else {
                paramType = usesBigInteger ? 'BigInteger' : this._inferCryptoParameterType(paramName);
                if (methodName === 'RotL8' || methodName === 'RotR8') {
                  console.error(`  ${param.name} type inferred:`, paramType);
                }
              }

              return paramType + ' ' + paramName;
            }).join(', ') : '';
          // Add params array if function uses arguments object
          if (usesArguments) {
            params = params ? params + ', params object[] args' : 'params object[] args';
          }

          // Use return type from typeInfo if available, otherwise infer
          let returnType;

          // First, try to infer return type (handles tuple detection)
          const inferredType = usesBigInteger ? 'BigInteger' : this._inferReturnType(methodName, propValue);

          // Prefer JSDoc type info if available, otherwise use inferred type
          if (typeInfo && typeInfo.returns) {
            returnType = this._mapJSTypeToCSharp(typeInfo.returns); // Convert JSDoc type to C#
          } else if (inferredType && inferredType.includes('(') && inferredType.includes(')')) {
            returnType = inferredType; // Tuple type from inference
          } else {
            returnType = inferredType; // Use inferred type
          }

          code += this._indent(`public static ${returnType} ${methodName}(${params})\n`);
          code += this._indent('{\n');
          this.indentLevel++;

          if (propValue.body) {
            // Pass return type in options for automatic casting in return statements
            const bodyOptions = { ...options, returnType, isMethodBody: true };

            // Arrow functions with implicit returns need special handling
            if (propValue.type === 'ArrowFunctionExpression' && propValue.body.type !== 'BlockStatement') {
              // Implicit return: body is an expression, wrap with return statement
              const expr = this._generateNode(propValue.body, bodyOptions);
              code += this._indent(`return ${expr};\n`);
            } else {
              // Regular function or arrow function with block statement
              const body = this._generateNode(propValue.body, bodyOptions);
              code += body || this._indent('return 0;\n');
            }
          } else {
            code += this._indent('return 0;\n');
          }

          this.indentLevel--;
          code += this._indent('}\n\n');
          continue;
        }

        // Handle other property types as constants or fields
        const constName = this._toPascalCase(propName);

        // If the property value is a simple object literal (data-only),
        // convert it to a nested static class with fields/methods
        if (propValue.type === 'ObjectExpression') {
          code += this._indent(`public static class ${constName}\n`);
          code += this._indent('{\n');
          this.indentLevel++;

          // Generate fields or methods for each property in the object
          for (const nestedProp of propValue.properties) {
            const fieldName = nestedProp.key && nestedProp.key.name ?
              this._toPascalCase(nestedProp.key.name) : 'Field';
            const nestedValue = nestedProp.value;

            // Check if this is a function - generate as method
            if (nestedValue && (nestedValue.type === 'FunctionExpression' || nestedValue.type === 'ArrowFunctionExpression')) {
              // Check for typeInfo metadata first (from AST preprocessing)
              const typeInfo = nestedValue.typeInfo;
              const usesArguments = this._usesArgumentsObject(nestedValue);

              let params = nestedValue.params ?
                nestedValue.params.map(param => {
                  const paramName = this._toCamelCase(param.name || 'param');

                  // Use type from typeInfo if available, otherwise infer
                  let paramType;
                  if (typeInfo && typeInfo.params && typeInfo.params.has(param.name)) {
                    paramType = typeInfo.params.get(param.name);
                  } else {
                    const usesBigInteger = this._functionUsesBigInteger(nestedValue);
                    paramType = usesBigInteger ? 'BigInteger' : this._inferCryptoParameterType(paramName);
                  }

                  return paramType + ' ' + paramName;
                }).join(', ') : '';
              // Add params array if function uses arguments object
              if (usesArguments) {
                params = params ? params + ', params object[] args' : 'params object[] args';
              }

              // Use return type from typeInfo if available, otherwise infer
              let returnType;

              // First, try to infer return type (handles tuple detection)
              const usesBigInteger = this._functionUsesBigInteger(nestedValue);
              const inferredType = usesBigInteger ? 'BigInteger' : this._inferReturnType(fieldName, nestedValue);

              // Prefer JSDoc type info if available, otherwise use inferred type
              if (typeInfo && typeInfo.returns) {
                returnType = typeInfo.returns; // Use JSDoc type (handles tuples correctly)
              } else if (inferredType && inferredType.includes('(') && inferredType.includes(')')) {
                returnType = inferredType; // Tuple type from inference
              } else {
                returnType = inferredType; // Use inferred type
              }

              code += this._indent(`public static ${returnType} ${fieldName}(${params})\n`);
              code += this._indent('{\n');
              this.indentLevel++;

              if (nestedValue.body) {
                // Pass return type in options for automatic casting in return statements
                const bodyOptions = { ...options, returnType, isMethodBody: true };

                // Arrow functions with implicit returns need special handling
                if (nestedValue.type === 'ArrowFunctionExpression' && nestedValue.body.type !== 'BlockStatement') {
                  // Implicit return: body is an expression, wrap with return statement
                  const expr = this._generateNode(nestedValue.body, bodyOptions);
                  code += this._indent(`return ${expr};\n`);
                } else {
                  // Regular function or arrow function with block statement
                  const body = this._generateNode(nestedValue.body, bodyOptions);
                  code += body || this._indent('return default;\n');
                }
              } else {
                code += this._indent('return default;\n');
              }

              this.indentLevel--;
              code += this._indent('}\n\n');
            } else {
              // Generate as field
              const fieldValue = this._generateNode(nestedValue, options);
              const fieldType = this._getNodeType(nestedValue, {});
              code += this._indent(`public static ${fieldType} ${fieldName} = ${fieldValue};\n`);
            }
          }

          this.indentLevel--;
          code += this._indent('}\n\n');
          continue; // Skip further processing of this property
        } else {
          // For non-object values, generate as a field
          const constValue = this._generateNode(propValue, options);
          const fieldType = this._getNodeType(propValue, {});
          code += this._indent(`public static ${fieldType} ${constName} = ${constValue};\n\n`);
        }
      }

      this.indentLevel--;
      code += '}';
      return code;
    }

    // If we have functions/methods but we're in a local context, we can't use static class
    // Generate a private nested class and instantiate it
    if (hasAnyFunctions && isLocalContext) {
      // Generate a unique class name based on context or counter
      if (!this.inlineObjectClassCounter) {
        this.inlineObjectClassCounter = 0;
      }
      const className = options.variableName
        ? `__${this._toPascalCase(options.variableName)}Class`
        : `__InlineObject${++this.inlineObjectClassCounter}`;

      // Build the nested class definition
      let classCode = `        private class ${className}\n`;
      classCode += `        {\n`;

      // Separate properties from methods
      const dataProps = node.properties.filter(prop =>
        !prop.method && (!prop.value || (
          prop.value.type !== 'FunctionExpression' &&
          prop.value.type !== 'ArrowFunctionExpression'
        ))
      );
      const methodProps = node.properties.filter(prop =>
        prop.method === true || (prop.value && (
          prop.value.type === 'FunctionExpression' ||
          prop.value.type === 'ArrowFunctionExpression'
        ))
      );

      // Generate fields for data properties
      for (const prop of dataProps) {
        const propName = prop.key && prop.key.name ? this._toPascalCase(prop.key.name) : 'Field';
        const propValue = prop.value;
        const fieldType = propValue ? this._getNodeType(propValue, { isCryptographic: true }) : 'object';
        classCode += `            public ${fieldType} ${propName};\n`;
      }

      if (dataProps.length > 0 && methodProps.length > 0) {
        classCode += '\n';
      }

      // Generate methods
      for (const prop of methodProps) {
        const methodName = prop.key && prop.key.name ? this._toPascalCase(prop.key.name) : 'Method';
        const funcNode = prop.value || prop; // For method shorthand, the function info may be on prop itself

        // Get parameters
        const params = funcNode.params ?
          funcNode.params.map(param => {
            const paramName = this._toCamelCase(param.name || 'param');
            const paramType = this._inferCryptoParameterType(paramName);
            return `${paramType} ${paramName}`;
          }).join(', ') : '';

        // Infer return type
        const returnType = this._extractJSDocReturnType(funcNode) ||
                          this._inferReturnTypeFromBody(funcNode) || 'uint';

        classCode += `            public ${returnType} ${methodName}(${params})\n`;
        classCode += `            {\n`;

        if (funcNode.body) {
          // Pass classFieldTypes for this.field access
          const fieldTypes = new Map();
          for (const dp of dataProps) {
            const fn = dp.key && dp.key.name ? this._toPascalCase(dp.key.name) : 'Field';
            const ft = dp.value ? this._getNodeType(dp.value, { isCryptographic: true }) : 'object';
            fieldTypes.set(fn, ft);
          }

          const bodyOptions = {
            ...options,
            isMethodBody: true,
            classFieldTypes: fieldTypes,
            returnType
          };

          if (funcNode.body.type === 'BlockStatement') {
            const body = this._generateNode(funcNode.body, bodyOptions);
            // Indent body properly
            const lines = body.split('\n').filter(line => line.trim());
            for (const line of lines) {
              classCode += `                ${line.trim()}\n`;
            }
          } else {
            // Arrow function with expression body
            const expr = this._generateNode(funcNode.body, bodyOptions);
            classCode += `                return ${expr};\n`;
          }
        } else {
          classCode += `                return default;\n`;
        }

        classCode += `            }\n`;
      }

      classCode += `        }\n`;

      // Store the nested class for later output
      if (!this.inlineObjectClasses) {
        this.inlineObjectClasses = [];
      }
      this.inlineObjectClasses.push({ name: className, code: classCode });

      // Return instantiation with field initializers
      let initCode = `new ${className}()`;
      if (dataProps.length > 0) {
        const inits = dataProps.map(prop => {
          const propName = prop.key && prop.key.name ? this._toPascalCase(prop.key.name) : 'Field';
          const propValue = prop.value ? this._generateNode(prop.value, options) : 'default';
          return `${propName} = ${propValue}`;
        });
        initCode = `new ${className}() { ${inits.join(', ')} }`;
      }

      return initCode;
    }

    // Regular object/dictionary - ensure keys are quoted string literals
    const properties = node.properties.map(prop => {
      let key;
      if (prop.key) {
        // Ensure key is a quoted string literal
        if (prop.key.type === 'Identifier') {
          key = `"${prop.key.name}"`;
        } else if (prop.key.type === 'Literal') {
          key = typeof prop.key.value === 'string' ? `"${prop.key.value}"` : String(prop.key.value);
        } else {
          key = `"${this._generateNode(prop.key, options)}"`;
        }
      } else {
        key = '"unknown"';
      }

      const value = prop.value ? this._generateNode(prop.value, options) : 'null';
      return `[${key}] = ${value}`;
    });

    return `new() { ${properties.join(', ')} }`;
  }

  /**
   * Detect if a function uses BigInteger by analyzing its AST
   * @private
   */
  _functionUsesBigInteger(funcNode) {
    if (!funcNode || !funcNode.body) return false;

    // Only detect actual BigInt usage - don't infer from large numbers
    // Large numbers should use ulong, not BigInteger
    const checkNode = (node) => {
      if (!node || typeof node !== 'object') return false;

      // Check for actual BigInt literals (type bigint or 'n' suffix)
      if (node.type === 'Literal') {
        if (typeof node.value === 'bigint') return true;
        if (node.raw && node.raw.endsWith('n')) return true;
        // DON'T treat large numbers as BigInteger - use ulong instead
      }

      // Check for BigInt() or bigInt() function calls
      if (node.type === 'CallExpression' &&
          node.callee && node.callee.type === 'Identifier' &&
          (node.callee.name === 'BigInt' || node.callee.name === 'bigInt')) {
        return true;
      }

      // Recursively check all properties
      for (const key in node) {
        if (key === 'loc' || key === 'range') continue; // Skip location info
        const value = node[key];
        if (Array.isArray(value)) {
          if (value.some(item => checkNode(item))) return true;
        } else if (typeof value === 'object') {
          if (checkNode(value)) return true;
        }
      }

      return false;
    };

    return checkNode(funcNode.body);
  }

  /**
   * Check if a function is a JavaScript constructor pattern.
   * Constructor patterns use this.property = value assignments.
   * @private
   */
  _isConstructorPattern(funcNode) {
    if (!funcNode || !funcNode.body) return false;

    // Only check for direct this.x = y assignments in the function body's statements
    // Not inside nested functions
    const body = funcNode.body;
    if (body.type !== 'BlockStatement' || !body.body) return false;

    for (const stmt of body.body) {
      if (stmt.type === 'ExpressionStatement' &&
          stmt.expression && stmt.expression.type === 'AssignmentExpression' &&
          stmt.expression.left && stmt.expression.left.type === 'MemberExpression' &&
          stmt.expression.left.object && stmt.expression.left.object.type === 'ThisExpression') {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract field assignments from a constructor function body.
   * Returns array of {name, value, isMethod} for each this.x = y assignment.
   * @private
   */
  _extractConstructorMembers(funcNode) {
    if (!funcNode || !funcNode.body) return [];

    const members = [];
    const body = funcNode.body;

    // Only check direct statements in the function body
    if (body.type !== 'BlockStatement' || !body.body) return [];

    for (const stmt of body.body) {
      // Check for this.property = value pattern
      if (stmt.type === 'ExpressionStatement' &&
          stmt.expression && stmt.expression.type === 'AssignmentExpression' &&
          stmt.expression.left && stmt.expression.left.type === 'MemberExpression' &&
          stmt.expression.left.object && stmt.expression.left.object.type === 'ThisExpression' &&
          stmt.expression.left.property) {
        const propName = stmt.expression.left.property.name || stmt.expression.left.property.value;
        const valueNode = stmt.expression.right;
        const isMethod = valueNode && (
          valueNode.type === 'FunctionExpression' ||
          valueNode.type === 'ArrowFunctionExpression'
        );
        // Extract JSDoc type and returns from comments on the statement
        let jsdocType = null;
        let jsdocReturns = null;
        if (stmt.leadingComments) {
          for (const comment of stmt.leadingComments) {
            if (comment.type === 'Block') {
              // Extract @type for fields
              const typeMatch = comment.value.match(/@type\s+\{([^}]+)\}/);
              if (typeMatch) {
                jsdocType = typeMatch[1].trim();
              }
              // Extract @returns for methods
              const returnsMatch = comment.value.match(/@returns?\s+\{([^}]+)\}/);
              if (returnsMatch) {
                jsdocReturns = returnsMatch[1].trim();
              }
            }
          }
        }
        members.push({
          name: propName,
          valueNode: valueNode,
          isMethod: isMethod,
          jsdocType: jsdocType,
          jsdocReturns: jsdocReturns,
          statementNode: stmt // Store the statement for JSDoc extraction
        });
      }
    }

    return members;
  }

  /**
   * Generate a nested class from a JavaScript function declaration inside a constructor body.
   * This handles the pattern: function ClassName(params) { this.prop = value; }
   *
   * For constructor patterns, we generate a proper inner class that can be used.
   * @private
   */
  _generateNestedClassFromFunction(node, options) {
    const className = node.id ? this._toPascalCase(node.id.name) : 'NestedClass';
    let code = '';

    // Check if this is a constructor pattern (uses this.property = value)
    if (this._isConstructorPattern(node)) {
      // Extract all this.property = value assignments
      const members = this._extractConstructorMembers(node);
      const fields = members.filter(m => !m.isMethod);
      const methods = members.filter(m => m.isMethod);

      // Store the class definition for later output at class scope
      // For now, generate a local class using C# nested class pattern
      if (!this.nestedClasses) {
        this.nestedClasses = [];
      }

      // Build the class definition
      let classCode = '';
      classCode += `        public class ${className}\n`;
      classCode += `        {\n`;

      // Generate fields
      // First, create a map of parameter names to types
      const paramTypeMap = new Map();
      if (node.params) {
        for (const param of node.params) {
          const paramName = param.name || 'param';
          const paramType = this._inferCryptoParameterType(this._toCamelCase(paramName));
          paramTypeMap.set(paramName, paramType);
        }
      }

      for (const field of fields) {
        const fieldName = this._toPascalCase(field.name);
        let fieldType = 'object';
        if (field.jsdocType) {
          fieldType = this._mapJSTypeToCSharp(field.jsdocType);
        } else if (field.valueNode && field.valueNode.type === 'Identifier' && paramTypeMap.has(field.valueNode.name)) {
          // Field is assigned from a parameter, use the parameter's type
          fieldType = paramTypeMap.get(field.valueNode.name);
        } else {
          fieldType = this._inferTypeFromValue(field.valueNode) || 'object';
        }
        classCode += `            public ${fieldType} ${fieldName};\n`;
      }

      // Generate method fields (as Action delegates)
      for (const method of methods) {
        const methodFieldName = this._toPascalCase(method.name);
        classCode += `            public Action ${methodFieldName};\n`;
      }

      // Generate constructor
      const params = node.params ?
        node.params.map(param => {
          const paramName = this._toCamelCase(param.name || 'param');
          const paramType = this._inferCryptoParameterType(paramName);
          return `${paramType} ${paramName}`;
        }).join(', ') : '';

      classCode += `            public ${className}(${params})\n`;
      classCode += `            {\n`;

      // Assign constructor parameters to fields
      for (const field of fields) {
        const fieldName = this._toPascalCase(field.name);
        // Check if there's a parameter with a similar name
        const matchingParam = node.params?.find(p =>
          p.name.toLowerCase() === field.name.toLowerCase() ||
          field.name === 'value' && node.params.length === 1
        );
        if (matchingParam) {
          const paramName = this._toCamelCase(matchingParam.name || 'param');
          classCode += `                ${fieldName} = ${paramName};\n`;
        } else if (field.valueNode) {
          // Use the initial value
          const initValue = this._generateNode(field.valueNode, options);
          classCode += `                ${fieldName} = ${initValue};\n`;
        }
      }

      // Initialize method delegates
      for (const method of methods) {
        const methodFieldName = this._toPascalCase(method.name);
        classCode += `                ${methodFieldName} = () => { /* ${method.name} implementation */ };\n`;
      }

      classCode += `            }\n`;
      classCode += `        }\n`;

      // Build field type map for use by prototype methods
      const fieldTypes = new Map();
      for (const field of fields) {
        const fieldName = this._toPascalCase(field.name);
        let fieldType = 'object';
        if (field.jsdocType) {
          fieldType = this._mapJSTypeToCSharp(field.jsdocType);
        } else if (field.valueNode && field.valueNode.type === 'Identifier' && paramTypeMap.has(field.valueNode.name)) {
          fieldType = paramTypeMap.get(field.valueNode.name);
        } else {
          fieldType = this._inferTypeFromValue(field.valueNode) || 'object';
        }
        fieldTypes.set(fieldName, fieldType);
      }

      // Store for later output
      this.nestedClasses.push({ name: className, code: classCode, fieldTypes: fieldTypes });

      // Don't output anything here - the class will be output at class scope
      code = '';

    } else {
      // Not a constructor pattern - generate as a local function (C# 7+)
      // Local functions ARE allowed in C#
      const params = node.params ?
        node.params.map(param => {
          const paramName = this._toCamelCase(param.name || 'param');
          const paramType = this._inferCryptoParameterType(paramName);
          return `${paramType} ${paramName}`;
        }).join(', ') : '';

      const returnType = this._extractJSDocReturnType(node) || this._inferReturnTypeFromBody(node) || 'object';

      code += this._indent(`${returnType} ${className}(${params})\n`);
      code += this._indent('{\n');
      this.indentLevel++;

      if (node.body) {
        const bodyOptions = { ...options, isConstructorBody: false };
        const body = this._generateNode(node.body, bodyOptions);
        code += body || this._indent('return default;\n');
      } else {
        code += this._indent('return default;\n');
      }

      this.indentLevel--;
      code += this._indent('}\n\n');
    }

    return code;
  }

  /**
   * Check if a function uses the JavaScript 'arguments' object.
   * Used to determine if C# params keyword is needed.
   * @private
   */
  _usesArgumentsObject(funcNode) {
    if (!funcNode || !funcNode.body) return false;

    const checkNode = (node) => {
      if (!node || typeof node !== 'object') return false;

      // Check for 'arguments' identifier
      if (node.type === 'Identifier' && node.name === 'arguments') {
        return true;
      }

      // Recursively check all properties
      for (const key in node) {
        if (key === 'loc' || key === 'range') continue;
        const value = node[key];
        if (Array.isArray(value)) {
          if (value.some(item => checkNode(item))) return true;
        } else if (typeof value === 'object') {
          if (checkNode(value)) return true;
        }
      }

      return false;
    };

    return checkNode(funcNode.body);
  }

  /**
   * Check if an expression explicitly uses BigInt (not just large numbers)
   * @private
   */
  _expressionIsExplicitBigInt(node) {
    if (!node || typeof node !== 'object') return false;

    // Check for actual BigInt literals
    if (node.type === 'Literal') {
      if (typeof node.value === 'bigint') return true;
      if (node.raw && node.raw.endsWith('n')) return true;
    }

    // Check for BigInt() function calls
    if (node.type === 'CallExpression' &&
        node.callee && node.callee.type === 'Identifier' &&
        (node.callee.name === 'BigInt' || node.callee.name === 'bigInt')) {
      return true;
    }

    // Recursively check direct children (not deep traversal)
    if (node.type === 'BinaryExpression' || node.type === 'LogicalExpression') {
      return this._expressionIsExplicitBigInt(node.left) || this._expressionIsExplicitBigInt(node.right);
    }
    if (node.type === 'UnaryExpression') {
      return this._expressionIsExplicitBigInt(node.argument);
    }

    return false;
  }

  /**
   * Infer return type from function body by analyzing return statements
   * This is a simpler version that just looks at what the function returns.
   * @private
   */
  _inferReturnTypeFromBody(funcNode) {
    if (!funcNode || !funcNode.body) return 'uint';

    // FIRST: Check preComputedTypes for JSDoc return type (including tuples)
    if (this.preComputedTypes) {
      const typeAnnotation = this.preComputedTypes.get(funcNode);
      if (typeAnnotation && typeAnnotation.type) {
        // Type is stored directly as { type: returnType, source: 'jsdoc' }
        return this._typeObjectToCSharp(typeAnnotation.type);
      }
    }

    // Find return statements in the function body
    const findReturnStatements = (node) => {
      if (!node || typeof node !== 'object') return [];

      if (node.type === 'ReturnStatement' && node.argument) {
        return [node.argument];
      }

      const results = [];
      for (const key in node) {
        if (key === 'loc' || key === 'range') continue;
        const value = node[key];
        if (Array.isArray(value)) {
          value.forEach(item => results.push(...findReturnStatements(item)));
        } else if (typeof value === 'object') {
          results.push(...findReturnStatements(value));
        }
      }
      return results;
    };

    const returnNodes = findReturnStatements(funcNode.body);
    if (returnNodes.length > 0) {
      // Infer type from first return statement with crypto context
      const returnType = this._getNodeType(returnNodes[0], { isCryptographic: true });
      return returnType;
    }

    // No return statements with values = void function
    return 'void';
  }

  /**
   * Infer parameter type for cryptographic operations
   * @private
   */
  _inferCryptoParameterType(paramName) {
    if (!paramName || typeof paramName !== 'string') return 'uint';

    const lower = paramName.toLowerCase();

    // Parameters with plural or array-like names should be arrays
    if (lower.includes('bytes') || lower.includes('data') || lower.includes('input') || lower.includes('output') ||
        lower.includes('buffer') || lower.includes('array')) {
      return 'byte[]';
    }

    // Words/values parameters (plural forms indicating arrays)
    // Note: single letter 'a' and 'b' are NOT arrays - only words/values/items which are clearly plural
    if (lower.includes('words') || lower === 'values' || lower === 'items') {
      return 'uint[]';
    }

    // Single byte parameter
    if (lower === 'byte') {
      return 'byte';
    }

    // Counters and sizes
    if (lower.includes('position') || lower.includes('count') || lower.includes('size') || lower.includes('length')) {
      return 'int';
    }

    // Default for crypto operations
    return 'uint';
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
    // Extract return type from JSDoc annotations if available
    let returnType = null;
    if (this.preComputedTypes && this.preComputedTypes.has(node)) {
      const funcTypeInfo = this.preComputedTypes.get(node);
      if (funcTypeInfo && funcTypeInfo.type) {
        returnType = this._mapJSTypeToCSharp(funcTypeInfo.type);
      }
    }

    // Generate parameters with types from JSDoc annotations
    const params = node.params ?
      node.params.map(param => {
        const paramName = this._toCamelCase(param.name || 'param');

        // Try to get type from pre-computed annotations
        let paramType = 'uint'; // Default
        if (this.preComputedTypes && this.preComputedTypes.has(param)) {
          const typeInfo = this.preComputedTypes.get(param);
          if (typeInfo && typeInfo.type) {
            paramType = this._mapJSTypeToCSharp(typeInfo.type);
          }
        }

        return `${paramType} ${paramName}`;
      }).join(', ') : '';

    let code = '((' + params + ') => {\n';
    this.indentLevel++;

    if (node.body) {
      // Pass return type to body generation for proper return statement casting
      const bodyOptions = returnType ? { ...options, returnType } : options;
      const body = this._generateNode(node.body, bodyOptions);
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
      return this._generateArrayConstructorCall(args, options);
    }

    // Handle Error constructors
    if (callee === 'Error') {
      return `new Exception(${args})`;
    }

    // Handle JavaScript TypedArray constructors
    const typedArrayMap = {
      'Uint8Array': 'byte',
      'Int8Array': 'sbyte',
      'Uint16Array': 'ushort',
      'Int16Array': 'short',
      'Uint32Array': 'uint',
      'Int32Array': 'int',
      'Float32Array': 'float',
      'Float64Array': 'double',
      'ArrayBuffer': 'byte'
    };

    if (typedArrayMap[callee]) {
      const elementType = typedArrayMap[callee];
      // new Uint8Array(size) -> new byte[size]
      // new Uint8Array(buffer) -> buffer (buffer is already byte[])
      if (node.arguments && node.arguments.length === 1) {
        const arg = node.arguments[0];
        // If argument is a number literal, create sized array
        if (arg.type === 'Literal' && typeof arg.value === 'number') {
          return `new ${elementType}[${args}]`;
        }
        // If argument is an identifier (buffer variable), this is a typed view pattern
        // In C#, we just use the byte[] buffer directly
        if (arg.type === 'Identifier') {
          const argName = this._generateNode(arg, options);
          // For Float64Array(buffer) pattern, return the buffer as-is since
          // we'll access it differently in C# (via BitConverter)
          return argName;
        }
        // If argument is an identifier that looks like a buffer, it might be the buffer view pattern
        // In that case, just return the buffer reference
        if (arg.type === 'MemberExpression' && arg.property && arg.property.name === 'buffer') {
          return this._generateNode(arg.object, options);
        }
        // Otherwise, create a new sized array
        return `new ${elementType}[${args}]`;
      }
      // No args - empty array
      return `new ${elementType}[0]`;
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
        if (typeof node.value === 'bigint') return 'BigInteger';
        if (node.raw && node.raw.endsWith('n')) return 'BigInteger';  // BigInt literal like 0xFFn
        if (typeof node.value === 'number') {
          // Check for very large numbers that should be BigInteger
          if (node.value > 0xFFFFFFFF || node.value > 4294967295) return 'BigInteger';
          // Cryptographic algorithms often use specific integer types
          if (Number.isInteger(node.value)) {
            if (node.value >= 0 && node.value <= 255) return 'byte';
            if (node.value >= -2147483648 && node.value <= 2147483647) return 'int';
            return 'uint';
          }
          return 'double';
        }
        if (typeof node.value === 'boolean') return 'bool';
        if (node.value === null) return this._makeNullable('object', true);
        break;
      case 'ArrayExpression':
        // Analyze array elements to determine specific type
        if (node.elements && node.elements.length > 0) {
          const firstElement = node.elements.find(el => el !== null && el !== undefined);
          if (firstElement) {
            const elementType = this._getNodeType(firstElement, context);
            if (elementType === 'byte' || elementType === 'int' || elementType === 'uint') {
              return elementType + '[]';
            }
          }
          // Non-empty arrays with known elements use fixed arrays
          return context.isCryptographic ? 'byte[]' : 'int[]';
        }
        // Empty arrays [] in crypto code are usually built up dynamically with push()
        // So we need List<T> instead of T[]
        return context.isCryptographic ? 'List<byte>' : 'List<int>';
      case 'NewExpression':
        if (node.callee && node.callee.name === 'Array') {
          // new Array(n) patterns in crypto often create byte or int arrays
          return context.isCryptographic ? 'byte[]' : 'int[]';
        }
        // Handle JavaScript TypedArray constructors
        if (node.callee && node.callee.type === 'Identifier') {
          const typedArrayTypeMap = {
            'Uint8Array': 'byte[]',
            'Int8Array': 'sbyte[]',
            'Uint16Array': 'ushort[]',
            'Int16Array': 'short[]',
            'Uint32Array': 'uint[]',
            'Int32Array': 'int[]',
            'Float32Array': 'float[]',
            'Float64Array': 'double[]',
            'ArrayBuffer': 'byte[]'
          };
          if (typedArrayTypeMap[node.callee.name]) {
            return typedArrayTypeMap[node.callee.name];
          }
        }
        const callee = this._generateNode(node.callee);
        return this._toPascalCase(callee);
      case 'CallExpression':
        return this._inferTypeFromCallExpression(node, context);
      case 'BinaryExpression':
        return this._inferTypeFromBinaryExpression(node, context);
      case 'UnaryExpression':
        return this._inferTypeFromUnaryExpression(node, context);
      case 'MemberExpression':
        return this._inferTypeFromMemberExpression(node, context);
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        return 'Func<int>'; // More specific than Func<object>
      case 'ObjectExpression':
        return 'Dictionary<string, object>';
      case 'ConditionalExpression':
        // Infer type from ternary expression branches
        // Try both branches - prefer the more specific non-literal type
        const consequentType = this._inferNodeType(node.consequent, context);
        const alternateType = this._inferNodeType(node.alternate, context);

        // Prefer byte over uint/int
        if (consequentType === 'byte' || alternateType === 'byte') return 'byte';
        // Prefer typed branch over generic int/uint/object
        if (consequentType && consequentType !== 'object' && consequentType !== 'int' && consequentType !== 'uint') {
          return consequentType;
        }
        if (alternateType && alternateType !== 'object' && alternateType !== 'int' && alternateType !== 'uint') {
          return alternateType;
        }
        // Fall back to consequent type
        return consequentType || (context.isCryptographic ? 'uint' : 'int');
    }
    return context.isCryptographic ? 'uint' : 'int'; // Better defaults for crypto
  }

  /**
   * Infer type from call expression (OpCodes, methods, etc.)
   * @private
   */
  _inferTypeFromCallExpression(node, context = {}) {
    // BigInteger constructor and parse calls
    if (node.callee && node.callee.type === 'Identifier' &&
        (node.callee.name === 'BigInt' || node.callee.name === 'bigInt')) {
      return 'BigInteger';
    }

    // BigInteger.Parse() calls
    if (node.callee && node.callee.type === 'MemberExpression' &&
        node.callee.object && node.callee.object.name === 'BigInteger' &&
        node.callee.property && node.callee.property.name === 'Parse') {
      return 'BigInteger';
    }

    if (node.callee && node.callee.type === 'MemberExpression') {
      const object = node.callee.object;
      const property = node.callee.property;

      // OpCodes method calls - types based on JSDoc annotations in OpCodes.js
      if (object && (object.name === 'OpCodes' || object.name === 'opCodes')) {
        const methodName = property.name || property;

        // Methods returning tuples (based on JSDoc annotations)
        // 64-bit operations returning (low: uint32, high: uint32) or (h: uint32, l: uint32)
        if (methodName === 'RotL64' || methodName === 'RotR64') {
          return '(uint low, uint high)';
        }
        if (methodName === 'Add64_HL' || methodName === 'RotR64_HL' || methodName === 'RotL64_HL' ||
            methodName === 'Swap64_HL' || methodName === 'Xor64_HL') {
          return '(uint h, uint l)';
        }
        if (methodName === 'FeistelRound') {
          return '(uint left, uint right)';
        }
        if (methodName === 'SplitNibbles') {
          return '(byte high, byte low)';
        }

        // Array-returning methods
        if (methodName.includes('Unpack')) {
          return 'byte[]';
        }
        if (methodName === 'FastXorArrays' || methodName === 'FastSubBytes' ||
            methodName === 'XorArrayWithByte' || methodName === 'EncodeMsgLength64LE' ||
            methodName === 'EncodeMsgLength128BE' || methodName === 'RotL128' ||
            methodName === 'RotR128' || methodName === 'CreateByteArrayFromHex' ||
            methodName === 'GetPooledArray' || methodName === 'BuildInverseSBox') {
          return 'byte[]';
        }
        if (methodName === 'FastXorWords32' || methodName === 'BatchRotL32' ||
            methodName === 'GenerateRoundConstants' || methodName === 'CreateUint32ArrayFromHex') {
          return 'uint[]';
        }
        if (methodName === 'CreateUint64ArrayFromHex') {
          return '(uint high, uint low)[]';
        }

        // Pack operations return the packed integer type
        if (methodName.includes('Pack32') || methodName.includes('Pack16')) {
          return 'uint';
        }
        if (methodName.includes('Pack64')) {
          return 'ulong';
        }
        if (methodName.includes('Bytes') || methodName.includes('ToBytes')) {
          return 'byte[]';
        }
        if (methodName.includes('Rot') || methodName.includes('Shift')) {
          return 'uint';
        }
        if (methodName.includes('Xor') && !methodName.includes('Array') && !methodName.includes('_HL')) {
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
        return this._getNodeType(object, context); // Same type as source array
      }
      if (property.name === 'fill') {
        // fill() returns the same array type as the source
        // For new Array(n).fill(0), the source is new Array(n) which becomes byte[] in crypto
        if (object.type === 'NewExpression' && object.callee && object.callee.name === 'Array') {
          return context.isCryptographic ? 'byte[]' : 'int[]';
        }
        return this._getNodeType(object, context);
      }
      if (property.name === 'concat') {
        // concat returns an array of the same type
        return this._getNodeType(object, context);
      }
      if (property.name === 'toArray' || property.name === 'ToArray') {
        // ToArray() returns an array - get the source type
        // If source is from Skip(), get the original array type
        if (object.type === 'CallExpression' && object.callee?.property?.name === 'Skip') {
          return this._getNodeType(object.callee.object, context);
        }
        return this._getNodeType(object, context);
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

    // Infer types of operands
    const leftType = this._getNodeType(node.left, context);
    const rightType = this._getNodeType(node.right, context);

    // If either operand is BigInteger, result is BigInteger for most operations
    const usesBigInteger = leftType === 'BigInteger' || rightType === 'BigInteger';

    // Bitwise operations return same type as operands
    if (['&', '|', '^', '<<', '>>', '>>>'].includes(operator)) {
      if (usesBigInteger) return 'BigInteger';

      // Detect byte masking pattern (x & 255 or x & 0xFF)
      if (operator === '&' && node.right.type === 'Literal') {
        if (node.right.value === 255 || node.right.value === 0xFF) {
          return 'byte';
        }
      }

      // IMPORTANT: JavaScript x | 0 pattern converts to (int)(x) in C#
      // The type of this expression is int, not uint
      if (operator === '|' && node.right.type === 'Literal' && node.right.value === 0) {
        return 'int';
      }

      // Unsigned right shift >>> 0 produces uint
      if (operator === '>>>' && node.right.type === 'Literal' && node.right.value === 0) {
        return 'uint';
      }

      return context.isCryptographic ? 'uint' : 'int';
    }

    // Comparison operations return bool
    if (['==', '!=', '===', '!==', '<', '>', '<=', '>='].includes(operator)) {
      return 'bool';
    }

    // Arithmetic operations - infer from operands
    if (['+', '-', '*', '/', '%'].includes(operator)) {
      // If either operand is BigInteger, result is BigInteger
      if (usesBigInteger) return 'BigInteger';

      // If either operand is floating point, result is double
      if (leftType === 'double' || rightType === 'double') {
        return 'double';
      }

      // In C#, arithmetic with any signed operand produces signed result
      // Literals are also int by default, so int * literal = int
      const isLeftLiteral = node.left.type === 'Literal' && typeof node.left.value === 'number';
      const isRightLiteral = node.right.type === 'Literal' && typeof node.right.value === 'number';
      const signedTypes = ['int', 'long', 'short', 'sbyte'];
      if (signedTypes.includes(leftType) || signedTypes.includes(rightType) ||
          isLeftLiteral || isRightLiteral) {
        // Signed result
        if (leftType === 'long' || rightType === 'long') return 'long';
        return 'int';
      }

      // Both operands are unsigned, result is unsigned
      if (leftType === 'ulong' || rightType === 'ulong') return 'ulong';
      return 'uint';
    }

    return context.isCryptographic ? 'uint' : 'int';
  }

  /**
   * Infer type from unary expression
   * @private
   */
  _inferTypeFromUnaryExpression(node, context = {}) {
    const operator = node.operator;

    // Handle ~~ (double tilde) idiom: produces int in C#
    if (operator === '~' && node.argument &&
        node.argument.type === 'UnaryExpression' && node.argument.operator === '~') {
      return 'int';
    }

    // Handle !! (double negation) idiom: produces bool
    if (operator === '!' && node.argument &&
        node.argument.type === 'UnaryExpression' && node.argument.operator === '!') {
      return 'bool';
    }

    // Single ~ is bitwise NOT, preserves type
    if (operator === '~') {
      return this._getNodeType(node.argument, context);
    }

    // ! is logical NOT, produces bool
    if (operator === '!') {
      return 'bool';
    }

    // Unary + converts to number, produces double for strings
    if (operator === '+') {
      const argType = this._getNodeType(node.argument, context);
      if (argType === 'string') return 'double';
      return argType;
    }

    // Unary - negation
    if (operator === '-') {
      return this._getNodeType(node.argument, context);
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

      // Ensure propertyName is a string before using string methods
      if (typeof propertyName !== 'string') {
        return context.isCryptographic ? 'uint' : 'int';
      }

      // Common property names
      if (propertyName === 'length') {
        return 'int';
      }
      // Properties that are typically single values (not arrays)
      if (propertyName === 'value') {
        // For this.value, it's usually a simple field - use uint as default
        if (node.object && node.object.type === 'ThisExpression') {
          return context.isCryptographic ? 'uint' : 'int';
        }
        return context.isCryptographic ? 'byte[]' : 'object';
      }
      if (propertyName === 'data') {
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
    if (!methodName || typeof methodName !== 'string') {
      return 'void';
    }

    // FIRST: Check preComputedTypes for JSDoc return type (including tuples)
    if (this.preComputedTypes && methodNode) {
      const typeAnnotation = this.preComputedTypes.get(methodNode);
      if (typeAnnotation && typeAnnotation.type) {
        // Type is stored directly as { type: returnType, source: 'jsdoc' }
        return this._typeObjectToCSharp(typeAnnotation.type);
      }
    }

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
          const inferredType = this._getNodeType(stmt.argument, context);
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
    if (!paramName || typeof paramName !== 'string') {
      return 'object';
    }
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

    let result = str.charAt(0).toLowerCase() + str.slice(1);

    // Sanitize reserved words and type names that conflict
    const csharpTypeNames = new Set([
      'byte', 'sbyte', 'short', 'ushort', 'int', 'uint', 'long', 'ulong',
      'float', 'double', 'decimal', 'char', 'bool', 'object', 'string',
      'void', 'var', 'dynamic'
    ]);

    const csharpKeywords = new Set([
      'abstract', 'as', 'base', 'break', 'case', 'catch', 'checked', 'class',
      'const', 'continue', 'default', 'delegate', 'do', 'else', 'enum', 'event',
      'explicit', 'extern', 'false', 'finally', 'fixed', 'for', 'foreach', 'goto',
      'if', 'implicit', 'in', 'interface', 'internal', 'is', 'lock', 'namespace',
      'new', 'null', 'operator', 'out', 'override', 'params', 'private', 'protected',
      'public', 'readonly', 'ref', 'return', 'sealed', 'sizeof', 'stackalloc',
      'static', 'struct', 'switch', 'this', 'throw', 'true', 'try', 'typeof',
      'unchecked', 'unsafe', 'using', 'virtual', 'volatile', 'while'
    ]);

    // If parameter name conflicts with type name or keyword, prefix with underscore
    if (csharpTypeNames.has(result) || csharpKeywords.has(result)) {
      result = result + 'Value';
    }

    return result;
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
   * Apply nullable type modifier if useNullableTypes option is enabled
   * @private
   */
  _makeNullable(type, isNullable = true) {
    if (!isNullable || !this.options.useNullableTypes) {
      return type;
    }

    // Don't add ? to types that already have it
    if (type.endsWith('?')) {
      return type;
    }

    // Don't add ? to value types (they require Nullable<T> or T? syntax)
    // For reference types (string, object, arrays, custom classes)
    const referenceTypes = ['string', 'object'];
    const isReferenceType = referenceTypes.includes(type) ||
                           type.includes('[]') ||
                           type.includes('<') ||
                           /^[A-Z]/.test(type); // Custom class names start with uppercase

    if (isReferenceType) {
      return type + '?';
    }

    return type;
  }

  /**
   * Choose between 'var' and explicit type based on useStrictTypes option
   * @private
   */
  _chooseVarOrType(inferredType) {
    // If useStrictTypes is false, prefer var for simplicity
    if (!this.options.useStrictTypes) {
      return 'var';
    }

    // If useStrictTypes is true, use explicit type when known
    // Fall back to var if type is unknown or generic 'object'
    if (inferredType && inferredType !== 'object') {
      return inferredType;
    }

    return 'var';
  }

  /**
   * Add proper indentation
   * @private
   */
  _indent(code) {
    const indentStr = this.options.indent.repeat(this.indentLevel);
    const lineEnd = this.options.lineEnding || '\n';
    return code.split(lineEnd).map(line =>
      line.trim() ? indentStr + line : line
    ).join(lineEnd);
  }

  /**
   * Wrap generated code with namespace structure
   * @private
   */
  _wrapWithNamespaceStructure(code, options) {
    let result = '';
    const indent1 = options.indent || '    '; // 1 level
    const indent2 = indent1 + indent1; // 2 levels
    const indent3 = indent2 + indent1; // 3 levels
    const lineEnd = options.lineEnding || '\n';

    // Using statements
    this.usings.add('System');
    this.usings.add('System.Collections.Generic');
    this.usings.add('System.Linq');
    this.usings.add('System.Numerics'); // For BigInteger support

    for (const using of this.usings) {
      result += 'using ' + using + ';' + lineEnd;
    }
    result += lineEnd;

    // File header comment
    if (options.addComments) {
      result += '/// <summary>' + lineEnd;
      result += '/// Generated C# code' + lineEnd;
      result += '/// This file was automatically generated from JavaScript AST' + lineEnd;
      result += '/// </summary>' + lineEnd;
    }

    // Namespace declaration
    result += 'namespace ' + options.namespace + lineEnd;
    result += '{' + lineEnd;

    // Class wrapper
    result += indent1 + '/// <summary>' + lineEnd;
    result += indent1 + '/// Main generated class' + lineEnd;
    result += indent1 + '/// </summary>' + lineEnd;
    result += indent1 + 'public class ' + options.className + lineEnd;
    result += indent1 + '{' + lineEnd;

    // Add Main method for console applications
    result += indent2 + '/// <summary>' + lineEnd;
    result += indent2 + '/// Main entry point for testing' + lineEnd;
    result += indent2 + '/// </summary>' + lineEnd;
    result += indent2 + '/// <param name="args">Command line arguments</param>' + lineEnd;
    result += indent2 + 'public static void Main(string[] args)' + lineEnd;
    result += indent2 + '{' + lineEnd;
    result += indent3 + '// Test code would go here' + lineEnd;
    result += indent3 + '// Example: var result = cipher.Encrypt(testData);' + lineEnd;
    result += indent3 + 'Console.WriteLine("Tests completed successfully");' + lineEnd;
    result += indent3 + 'Console.WriteLine("Generated code execution");' + lineEnd;
    result += indent2 + '}' + lineEnd + lineEnd;

    // Output nested classes first (these are generated from JavaScript constructor patterns)
    if (this.nestedClasses && this.nestedClasses.length > 0) {
      result += indent2 + '// Nested classes generated from JavaScript constructor patterns' + lineEnd;
      for (const nestedClass of this.nestedClasses) {
        let classCode = nestedClass.code;

        // Check if there are prototype methods for this class
        if (this.prototypeMethods && this.prototypeMethods.has(nestedClass.name)) {
          const methods = this.prototypeMethods.get(nestedClass.name);
          // Insert the methods before the closing brace of the class
          const closingPattern = indent2 + '}' + lineEnd;
          const lastBraceIndex = classCode.lastIndexOf(closingPattern);
          if (lastBraceIndex !== -1) {
            const beforeBrace = classCode.substring(0, lastBraceIndex);
            const closingBrace = classCode.substring(lastBraceIndex);
            classCode = beforeBrace + lineEnd + methods.join(lineEnd) + closingBrace;
          }
        }

        result += classCode + lineEnd;
      }
    }

    // Output inline object classes (generated from ES6 object literals with methods)
    if (this.inlineObjectClasses && this.inlineObjectClasses.length > 0) {
      result += indent2 + '// Inline object classes generated from ES6 object literals with methods' + lineEnd;
      for (const inlineClass of this.inlineObjectClasses) {
        result += inlineClass.code + lineEnd;
      }
    }

    // Generated code (indented)
    const indentedCode = code.split(lineEnd).map(line =>
      line.trim() ? indent2 + line : line
    ).join(lineEnd);

    result += indentedCode + lineEnd;
    result += indent1 + '}' + lineEnd;
    result += '}' + lineEnd;

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

    // Warnings disabled to avoid polluting output
    // TODO: Add meaningful warnings based on actual code analysis

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
   * Generate OpCodes method call with C# equivalents
   * @private
   */
  _generateOpCodesCall(methodName, args) {
    // For now, pass through to OpCodes library calls
    // TODO: Implement C#-specific OpCodes transformations
    return `OpCodes.${methodName}(${args})`;
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

  /**
   * Build type map by analyzing the AST
   * This is the FIRST PASS - it traverses the AST and infers types for functions, variables, etc.
   * @private
   */
  _buildTypeMap(node, options, context = {}, pathPrefix = '') {
    if (!node || typeof node !== 'object') return;

    // Build a scope context to track variable types
    const newContext = { ...context };

    // Analyze different node types and infer their types
    switch (node.type) {
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        {
          const returnType = this._analyzeReturnType(node);
          this.typeMap.set(node, { returnType, nodeType: returnType });

          // Register function in registry if we have a path
          if (pathPrefix) {
            // Extract parameter types from JSDoc
            const paramTypes = {};
            if (node.params) {
              node.params.forEach(param => {
                if (param.type === 'Identifier') {
                  paramTypes[param.name] = this._extractJSDocParamType(node, param.name) || 'object';
                }
              });
            }

            this.functionRegistry.set(pathPrefix, {
              returnType,
              paramTypes,
              node
            });
          }

          // Analyze parameters and add to scope
          if (node.params) {
            node.params.forEach(param => {
              if (param.type === 'Identifier') {
                const paramType = this._extractJSDocParamType(node, param.name) || 'object';
                newContext[param.name] = paramType;
                this.typeMap.set(param, { nodeType: paramType });
              }
            });
          }
        }
        break;

      case 'VariableDeclarator':
        {
          if (node.id && node.id.type === 'Identifier' && node.init) {
            const varName = node.id.name;

            // If initializer is an object expression, traverse it with the variable name as path prefix
            if (node.init.type === 'ObjectExpression') {
              this._buildTypeMap(node.init, options, newContext, varName);
            } else {
              // Regular initialization
              this._buildTypeMap(node.init, options, newContext, pathPrefix);
            }

            // Get the inferred type from the initializer
            const initType = this.typeMap.get(node.init)?.nodeType || this._inferNodeType(node.init, newContext);

            // Store variable type in context and typeMap
            newContext[varName] = initType;
            this.typeMap.set(node.id, { nodeType: initType });
            this.typeMap.set(node, { nodeType: initType });
          }
        }
        break;

      case 'CallExpression':
        {
          // Infer the return type of the called function
          if (node.callee) {
            // First analyze the callee
            this._buildTypeMap(node.callee, options, newContext, pathPrefix);

            // Try to determine return type
            let callReturnType = null; // Changed to null - only set if we find a specific type
            let lookupStats = { found: false, path: null }; // For debugging

            // If callee is a member expression like OpCodes.Pack32BE
            if (node.callee.type === 'MemberExpression') {
              // Build the full path for the member expression
              const funcPath = this._getMemberExpressionPath(node.callee);
              lookupStats.path = funcPath;
              if (funcPath) {
                // Look up in function registry
                const funcSig = this.functionRegistry.get(funcPath);
                if (funcSig?.returnType) {
                  callReturnType = funcSig.returnType;
                  lookupStats.found = true;
                }
              }
            }
            // If callee is an identifier, look up in context
            else if (node.callee.type === 'Identifier') {
              const funcName = node.callee.name;
              lookupStats.path = funcName;

              // First check function registry
              const funcSig = this.functionRegistry.get(funcName);
              if (funcSig?.returnType) {
                callReturnType = funcSig.returnType;
                lookupStats.found = true;
              } else {
                // Fall back to context
                const funcType = newContext[funcName];
                if (funcType) {
                  callReturnType = funcType;
                  lookupStats.found = true;
                }
              }
            }

            // Track statistics
            if (!this._callLookupStats) this._callLookupStats = { total: 0, found: 0, notFound: [] };
            this._callLookupStats.total++;
            if (lookupStats.found) {
              this._callLookupStats.found++;
            } else if (lookupStats.path) {
              this._callLookupStats.notFound.push(lookupStats.path);
            }

            // Only add to typeMap if we found a specific type
            // If null, fallback inference in _getNodeType will handle it
            if (callReturnType) {
              this.typeMap.set(node, { nodeType: callReturnType });
            }
          }
        }
        break;

      case 'MemberExpression':
        {
          // For member expressions like OpCodes.Pack32BE, we need to find the function
          // This requires looking up the object's properties
          // For now, store a placeholder
          this.typeMap.set(node, { nodeType: 'object' });
        }
        break;

      case 'BinaryExpression':
        {
          // Infer type based on operator and operands
          this._buildTypeMap(node.left, options, newContext);
          this._buildTypeMap(node.right, options, newContext);

          const leftType = this.typeMap.get(node.left)?.nodeType;
          const rightType = this.typeMap.get(node.right)?.nodeType;

          let resultType = 'uint';
          if (leftType === 'BigInteger' || rightType === 'BigInteger') {
            resultType = 'BigInteger';
          } else if (leftType === 'ulong' || rightType === 'ulong') {
            resultType = 'ulong';
          }

          this.typeMap.set(node, { nodeType: resultType });
        }
        break;

      case 'ArrayExpression':
        {
          // Infer array element type from first element
          if (node.elements && node.elements.length > 0) {
            const firstElem = node.elements.find(e => e !== null);
            if (firstElem) {
              this._buildTypeMap(firstElem, options, newContext);
              const elemType = this.typeMap.get(firstElem)?.nodeType || 'byte';
              this.typeMap.set(node, { nodeType: `${elemType}[]` });
            } else {
              this.typeMap.set(node, { nodeType: 'byte[]' });
            }
          } else {
            this.typeMap.set(node, { nodeType: 'byte[]' });
          }
        }
        break;

      case 'Literal':
        {
          // Infer type from literal value
          let litType = 'object';
          if (typeof node.value === 'number') {
            if (Number.isInteger(node.value)) {
              if (node.value >= 0 && node.value <= 255) litType = 'byte';
              else if (node.value >= 0 && node.value <= 65535) litType = 'ushort';
              else if (node.value >= 0 && node.value <= 4294967295) litType = 'uint';
              else litType = 'ulong';
            } else {
              litType = 'double';
            }
          } else if (typeof node.value === 'string') {
            litType = 'string';
          } else if (typeof node.value === 'boolean') {
            litType = 'bool';
          }
          this.typeMap.set(node, { nodeType: litType });
        }
        break;

      case 'Identifier':
        {
          // Look up identifier type in context
          const idType = newContext[node.name] || 'object';
          this.typeMap.set(node, { nodeType: idType });
        }
        break;

      case 'ObjectExpression':
        {
          // Traverse object properties with path prefix
          if (node.properties) {
            node.properties.forEach(prop => {
              if (prop.type === 'Property' && prop.key) {
                const propName = prop.key.name || prop.key.value;
                const propPath = pathPrefix ? `${pathPrefix}.${propName}` : propName;

                // Traverse the property value with the full path
                if (prop.value) {
                  this._buildTypeMap(prop.value, options, newContext, propPath);
                }
              }
            });
          }
          this.typeMap.set(node, { nodeType: 'object' });
        }
        break;

      case 'Property':
        {
          // Property nodes are handled by ObjectExpression
          // But we still need to traverse in case of nested structures
          if (node.value) {
            this._buildTypeMap(node.value, options, newContext, pathPrefix);
          }
        }
        break;
    }

    // Recursively analyze child nodes (skip if already handled in switch)
    if (node.type !== 'ObjectExpression' && node.type !== 'Property' && node.type !== 'VariableDeclarator') {
      for (const key in node) {
        if (key === 'loc' || key === 'range') continue;
        const value = node[key];
        if (Array.isArray(value)) {
          value.forEach(item => this._buildTypeMap(item, options, newContext, pathPrefix));
        } else if (typeof value === 'object') {
          this._buildTypeMap(value, options, newContext, pathPrefix);
        }
      }
    }
  }

  /**
   * Helper to get type of a node - prefers pre-computed types, falls back to inference
   * This is the PRIMARY method to use for getting node types
   * @private
   */
  _getNodeType(node, context = {}) {
    if (!node) return 'object';

    // For identifiers, check variableTypes first (set by JSDoc parameter types)
    if (node.type === 'Identifier' && node.name && this.variableTypes) {
      const varType = this.variableTypes.get(node.name);
      if (varType) {
        return varType;
      }
    }

    // FIRST: Check pre-computed type annotations from TypeAwareTranspiler
    if (this.preComputedTypes) {
      const preComputed = this.preComputedTypes.get(node);
      if (preComputed?.type) {
        // Convert type object to C# type string
        return this._typeObjectToCSharp(preComputed.type);
      }
    }

    // SECOND: Fall back to old inference method
    return this._inferTypeFromValue(node, context);
  }

  /**
   * Convert a type object (from TypeAwareTranspiler) to C# type string
   * Type can be: string, {name: 'type'}, or {name: 'type[]', isArray: true, elementType: {...}}
   * @private
   */
  _typeObjectToCSharp(type) {
    if (!type) return 'object';

    // Already a string - just map to C# type
    if (typeof type === 'string') {
      return this._mapJSTypeToCSharp(type);
    }

    // Type object with name property
    if (typeof type === 'object') {
      const typeName = type.name;

      // Check if it's a tuple type (from JSDoc Object with {prop: type, prop: type} description)
      if (type.isTuple && type.tupleElements && type.tupleElements.length > 0) {
        const tupleParts = type.tupleElements.map(elem => {
          const elemType = this._typeObjectToCSharp(elem.type);
          return `${elemType} ${elem.name}`;
        });
        return `(${tupleParts.join(', ')})`;
      }

      if (!typeName) return 'object';

      // Check if it's an array type
      if (type.isArray || typeName.endsWith('[]')) {
        const baseTypeName = typeName.endsWith('[]') ? typeName.slice(0, -2) : typeName;
        const elementType = type.elementType
          ? this._typeObjectToCSharp(type.elementType)
          : this._mapJSTypeToCSharp(baseTypeName);
        return elementType + '[]';
      }

      return this._mapJSTypeToCSharp(typeName);
    }

    return 'object';
  }

  /**
   * Extract type name string from a type value (handles both string and type object)
   * Type can be either a simple string like "uint32" or a type object like {name: "uint32", isArray: false, ...}
   * @private
   */
  _getTypeName(type) {
    if (!type) return null;
    if (typeof type === 'string') return type;
    if (typeof type === 'object' && type.name) return type.name;
    return null;
  }

  /**
   * Check if a type represents an array type
   * Handles both "type[]" strings and type objects with isArray property
   * @private
   */
  _isArrayType(type) {
    if (!type) return false;
    if (typeof type === 'string') return type.endsWith('[]');
    if (typeof type === 'object') return type.isArray === true;
    return false;
  }

  /**
   * Build full path string from MemberExpression AST node
   * e.g., OpCodes.Pack32BE → "OpCodes.Pack32BE"
   * e.g., OpCodes.UInt64.Create → "OpCodes.UInt64.Create"
   * @private
   */
  _getMemberExpressionPath(node) {
    if (!node) return null;

    if (node.type === 'Identifier') {
      return node.name;
    }

    if (node.type === 'MemberExpression') {
      const objectPath = this._getMemberExpressionPath(node.object);
      const propertyName = node.property?.name || node.property?.value;

      if (!objectPath || !propertyName) return null;

      return `${objectPath}.${propertyName}`;
    }

    return null;
  }

  /**
   * Helper to infer type of a node based on AST structure
   * @private
   */
  _inferNodeType(node, context) {
    if (!node) return 'object';

    // Check if we already have it in typeMap
    const existing = this.typeMap.get(node);
    if (existing?.nodeType) return existing.nodeType;

    // Infer based on node type
    switch (node.type) {
      case 'Literal':
        if (typeof node.value === 'number') {
          if (Number.isInteger(node.value)) {
            if (node.value >= 0 && node.value <= 255) return 'byte';
            if (node.value >= 0 && node.value <= 65535) return 'ushort';
            if (node.value >= 0 && node.value <= 4294967295) return 'uint';
            return 'ulong';
          }
          return 'double';
        }
        if (typeof node.value === 'string') return 'string';
        if (typeof node.value === 'boolean') return 'bool';
        return 'object';

      case 'ArrayExpression':
        return 'byte[]';

      case 'Identifier':
        return context[node.name] || 'object';

      case 'CallExpression':
        return 'object'; // Would need function signature lookup

      default:
        return 'object';
    }
  }

  /**
   * Analyze function body to determine return type
   * Prioritizes JSDoc comments over AST analysis
   * @private
   */
  _analyzeReturnType(funcNode) {
    if (!funcNode || !funcNode.body) return 'uint';

    // FIRST: Try to extract return type from JSDoc comments
    const jsdocType = this._extractJSDocReturnType(funcNode);
    if (jsdocType) {
      return jsdocType;
    }

    // SECOND: Analyze return statements
    const returnStatements = [];
    const findReturns = (node) => {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'ReturnStatement' && node.argument) {
        returnStatements.push(node.argument);
      }
      for (const key in node) {
        if (key === 'loc' || key === 'range') continue;
        const value = node[key];
        if (Array.isArray(value)) {
          value.forEach(item => findReturns(item));
        } else if (typeof value === 'object') {
          findReturns(value);
        }
      }
    };

    findReturns(funcNode.body);

    // Analyze return statements to infer type
    if (returnStatements.length > 0) {
      // Check first return statement
      const firstReturn = returnStatements[0];

      // If it's an array expression, infer array type
      if (firstReturn.type === 'ArrayExpression' && firstReturn.elements && firstReturn.elements.length > 0) {
        const firstElement = firstReturn.elements.find(el => el !== null && el !== undefined);
        if (firstElement) {
          const elementType = this._getNodeType(firstElement, { isCryptographic: true });
          if (elementType === 'byte' || elementType === 'int' || elementType === 'uint') {
            return elementType + '[]';
          }
        }
        return 'uint[]'; // Default for crypto operations
      }

      // For other types, use existing type inference
      return this._getNodeType(firstReturn, { isCryptographic: true });
    }

    return 'uint'; // Default
  }

  /**
   * Extract return type from JSDoc @returns tag
   * @private
   */
  _extractJSDocReturnType(funcNode) {
    // Check if function has leading comments (JSDoc)
    if (!funcNode.leadingComments || funcNode.leadingComments.length === 0) {
      return null;
    }

    // Look for @returns tag in comments
    for (const comment of funcNode.leadingComments) {
      if (comment.type !== 'Block') continue;

      const text = comment.value;

      // Extended regex to capture the description after the type
      const returnsMatch = text.match(/@returns?\s+\{([^}]+)\}\s*(.+)?/);

      if (returnsMatch) {
        const jsType = returnsMatch[1].trim();
        const description = returnsMatch[2] ? returnsMatch[2].trim() : '';

        // Check for Object type with tuple-like description: {propName: type, propName: type}
        if (jsType === 'Object' && description) {
          const tuplePattern = /\{([^}]+)\}/;
          const tupleMatch = description.match(tuplePattern);
          if (tupleMatch) {
            const tupleContent = tupleMatch[1];
            // Parse comma-separated "propName: type" pairs
            const pairs = tupleContent.split(',').map(p => p.trim()).filter(p => p);
            const tupleParts = pairs.map(pair => {
              const colonIdx = pair.indexOf(':');
              if (colonIdx > 0) {
                const propName = pair.substring(0, colonIdx).trim();
                const propType = pair.substring(colonIdx + 1).trim();
                const csharpType = this._mapJSTypeToCSharp(propType);
                return `${csharpType} ${propName}`;
              }
              return null;
            }).filter(p => p);

            if (tupleParts.length > 0) {
              return `(${tupleParts.join(', ')})`;
            }
          }
        }

        // Map JavaScript types to C# types
        if (jsType === 'Array' || jsType.includes('Array')) {
          // Check if it specifies element type like Array<number>
          const elementMatch = jsType.match(/Array<(\w+)>/);
          if (elementMatch) {
            const elementType = this._mapJSTypeToCSharp(elementMatch[1]);
            return elementType + '[]';
          }
          return 'uint[]'; // Default for crypto arrays
        }

        if (jsType === 'number') return 'uint';
        if (jsType === 'string') return 'string';
        if (jsType === 'boolean' || jsType === 'bool') return 'bool';
        if (jsType === 'void') return 'void';
        if (jsType === 'bigint' || jsType === 'BigInt') return 'BigInteger';
        if (jsType.endsWith('[]')) {
          const baseType = this._mapJSTypeToCSharp(jsType.slice(0, -2));
          return baseType + '[]';
        }

        // Try to map unknown types
        return this._mapJSTypeToCSharp(jsType);
      }
    }

    return null;
  }

  /**
   * Extract parameter type from JSDoc @param tag
   * @private
   */
  _extractJSDocParamType(funcNode, paramName) {
    // Check if function has leading comments (JSDoc)
    if (!funcNode.leadingComments || funcNode.leadingComments.length === 0) {
      return null;
    }

    // Look for @param tag matching this parameter name
    for (const comment of funcNode.leadingComments) {
      if (comment.type !== 'Block') continue;

      const text = comment.value;
      // Match @param {type} paramName
      const paramPattern = new RegExp(`@param\\s+\\{([^}]+)\\}\\s+${paramName}\\b`);
      const paramMatch = text.match(paramPattern);

      if (paramMatch) {
        const jsType = paramMatch[1].trim();

        // Map JavaScript types to C# types
        if (jsType.endsWith('[]')) {
          const baseType = this._mapJSTypeToCSharp(jsType.slice(0, -2));
          return baseType + '[]';
        }

        return this._mapJSTypeToCSharp(jsType);
      }
    }

    return null;
  }

  /**
   * Map JavaScript type names to C# type names
   * @private
   */
  _mapJSTypeToCSharp(jsType) {
    // Handle type objects from JSDoc parser
    if (typeof jsType === 'object' && jsType !== null) {
      const typeName = jsType.name || 'object';
      const isArray = jsType.isArray || false;

      // Map the base type name
      const mappedBase = this._mapJSTypeToCSharp(typeName);

      // Add array suffix if needed
      if (isArray && !mappedBase.endsWith('[]')) {
        return mappedBase + '[]';
      }

      return mappedBase;
    }

    // Handle string type names
    if (typeof jsType !== 'string') {
      return 'object';
    }

    // Handle JSDoc tuple types like [uint8, uint8] or [uint8, uint8, uint8, uint8]
    // These represent fixed-length arrays and should become typed arrays in C#
    const tupleMatch = jsType.match(/^\[([^\]]+)\]$/);
    if (tupleMatch) {
      const elements = tupleMatch[1].split(',').map(e => e.trim());
      if (elements.length > 0) {
        // Get the first element type to determine the array element type
        const firstType = elements[0];
        const mappedElementType = this._mapJSTypeToCSharp(firstType);
        return mappedElementType + '[]';
      }
    }

    // Handle JSDoc tuple array types like (name: type, name: type)[]
    // These should become C# named tuple arrays (type name, type name)[]
    const tupleArrayMatch = jsType.match(/^\(([^)]+)\)\[\]$/);
    if (tupleArrayMatch) {
      const fieldDefs = tupleArrayMatch[1].split(',').map(f => f.trim());
      const tupleElements = [];
      for (const fieldDef of fieldDefs) {
        // Parse "name: type" patterns where type can include [] for arrays
        const colonMatch = fieldDef.match(/^(\w+)\s*:\s*(\w+(?:\[\])?)$/);
        if (colonMatch) {
          const [, fieldName, fieldType] = colonMatch;
          const mappedType = this._mapJSTypeToCSharp(fieldType);
          tupleElements.push(`${mappedType} ${fieldName}`);
        }
      }
      if (tupleElements.length > 0) {
        return `(${tupleElements.join(', ')})[]`;
      }
    }

    // Handle JSDoc tuple types like (name: type, name: type)
    // These should become C# named tuples (type name, type name)
    // Note: type can include [] for arrays, e.g., (high64: uint32[], low64: uint32[])
    const directTupleMatch = jsType.match(/^\(([^)]+)\)$/);
    if (directTupleMatch) {
      const fieldDefs = directTupleMatch[1].split(',').map(f => f.trim());
      const tupleElements = [];
      for (const fieldDef of fieldDefs) {
        // Parse "name: type" patterns where type can include [] for arrays
        const colonMatch = fieldDef.match(/^(\w+)\s*:\s*(\w+(?:\[\])?)$/);
        if (colonMatch) {
          const [, fieldName, fieldType] = colonMatch;
          const mappedType = this._mapJSTypeToCSharp(fieldType);
          tupleElements.push(`${mappedType} ${fieldName}`);
        }
      }
      if (tupleElements.length > 0) {
        return `(${tupleElements.join(', ')})`;
      }
    }

    // Handle JSDoc tuple types like {(high32: uint32, low32: uint32)} (legacy format)
    // These should become C# named tuples (uint high32, uint low32)
    const parenTupleMatch = jsType.match(/^\{\(([^)]+)\)\}$/);
    if (parenTupleMatch) {
      const fieldDefs = parenTupleMatch[1].split(',').map(f => f.trim());
      const tupleElements = [];
      for (const fieldDef of fieldDefs) {
        // Parse "name: type" patterns where type can include [] for arrays
        const colonMatch = fieldDef.match(/^(\w+)\s*:\s*(\w+(?:\[\])?)$/);
        if (colonMatch) {
          const [, fieldName, fieldType] = colonMatch;
          const mappedType = this._mapJSTypeToCSharp(fieldType);
          tupleElements.push(`${mappedType} ${fieldName}`);
        }
      }
      if (tupleElements.length > 0) {
        return `(${tupleElements.join(', ')})`;
      }
    }

    // Handle JSDoc record/named tuple types like {low: uint32, high: uint32}
    // These should become C# named tuples (uint low, uint high)
    const recordMatch = jsType.match(/^\{([^}]+)\}$/);
    if (recordMatch) {
      const fieldDefs = recordMatch[1].split(',').map(f => f.trim());
      const tupleElements = [];
      for (const fieldDef of fieldDefs) {
        // Parse "name: type" or just "name" patterns where type can include [] for arrays
        const colonMatch = fieldDef.match(/^(\w+)\s*:\s*(\w+(?:\[\])?)$/);
        if (colonMatch) {
          const [, fieldName, fieldType] = colonMatch;
          const mappedType = this._mapJSTypeToCSharp(fieldType);
          tupleElements.push(`${mappedType} ${fieldName}`);
        } else if (/^\w+$/.test(fieldDef)) {
          // Just a field name without type - default to uint
          tupleElements.push(`uint ${fieldDef}`);
        }
      }
      if (tupleElements.length > 0) {
        return `(${tupleElements.join(', ')})`;
      }
    }

    const typeMap = {
      // Generic types
      'number': 'uint',
      'string': 'string',
      'boolean': 'bool',
      'void': 'void',
      // BigInt can be 64-bit (ulong) or 128-bit+ (BigInteger)
      // Default to BigInteger for safety; use uint64 explicitly for 64-bit
      'bigint': 'BigInteger',
      'BigInt': 'BigInteger',
      // Explicit 64-bit BigInt - use ulong
      'uint64n': 'ulong',
      'int64n': 'long',
      'Array': 'byte[]',  // Default Array to byte[] for crypto code
      'Uint8Array': 'byte[]',
      'Uint16Array': 'ushort[]',
      'Uint32Array': 'uint[]',
      'Int8Array': 'sbyte[]',
      'Int16Array': 'short[]',
      'Int32Array': 'int[]',
      'Float32Array': 'float[]',
      'Float64Array': 'double[]',
      'ArrayBuffer': 'byte[]',
      // Object type in JSDoc often represents a record/named tuple
      // Default to a generic tuple for {low, high} patterns
      'object': 'object',
      'Object': 'object',
      'any': 'object',
      // BitStream is a special type for bit-level operations
      'BitStream': '_BitStream',
      '_BitStream': '_BitStream',

      // Specific integer types
      'uint8': 'byte',
      'int8': 'sbyte',
      'uint16': 'ushort',
      'int16': 'short',
      'uint32': 'uint',
      'int32': 'int',
      'uint64': 'ulong',
      'int64': 'long',
      // C# type names (for direct JSDoc usage)
      'byte': 'byte',
      'sbyte': 'sbyte',
      'ushort': 'ushort',
      'short': 'short',
      'uint': 'uint',
      'int': 'int',
      'ulong': 'ulong',
      'long': 'long',

      // Floating point
      'float32': 'float',
      'float64': 'double',
      'float': 'float',
      'double': 'double',

      // Byte and char types
      'byte': 'byte',
      'char': 'char',

      // Array types
      'uint8[]': 'byte[]',
      'int8[]': 'sbyte[]',
      'uint16[]': 'ushort[]',
      'int16[]': 'short[]',
      'uint32[]': 'uint[]',
      'int32[]': 'int[]',
      'uint64[]': 'ulong[]',
      'int64[]': 'long[]',
      'byte[]': 'byte[]',
      'string[]': 'string[]'
    };

    return typeMap[jsType] || 'uint';
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