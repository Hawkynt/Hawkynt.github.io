/**
 * RubyTransformer.js - IL AST to Ruby AST Transformer
 * Converts IL AST (type-inferred, language-agnostic) to Ruby AST
 * (c)2006-2025 Hawkynt
 *
 * Full Pipeline:
 *   JS Source → Parser → JS AST → IL Transformer → IL AST → Language Transformer → Language AST → Language Emitter → Language Source
 *
 * This transformer handles: IL AST → Ruby AST
 *
 * IL AST characteristics:
 *   - Type-inferred (no untyped nodes)
 *   - Language-agnostic (no JS-specific constructs like UMD, IIFE, Math.*, Object.*, etc.)
 *   - Global options already applied
 *
 * Language options (applied here and in emitter):
 *   - useFrozenStringLiteral: Enable frozen string literals
 *   - useSymbolKeys: Use symbols for hash keys
 *   - addComments: Include generated comments
 */

(function(global) {
  'use strict';

  // Load dependencies
  let RubyAST;
  if (typeof require !== 'undefined') {
    RubyAST = require('./RubyAST.js');
  } else if (global.RubyAST) {
    RubyAST = global.RubyAST;
  }

  let RubyEmitter;
  if (typeof require !== 'undefined') {
    ({ RubyEmitter } = require('./RubyEmitter.js'));
  } else if (global.RubyEmitter) {
    RubyEmitter = global.RubyEmitter;
  }

  const {
    RubyType, RubyModule, RubyRequire, RubyMagicComment,
    RubyClass, RubyModuleDef, RubyAttribute,
    RubyMethod, RubyParameter, RubyBlock, RubyAssignment, RubyExpressionStatement,
    RubyReturn, RubyIf, RubyCase, RubyWhen, RubyFor, RubyWhile, RubyLoop,
    RubyBreak, RubyNext, RubyRaise, RubyBegin, RubyRescue,
    RubyLiteral, RubyIdentifier, RubyBinaryExpression, RubyUnaryExpression,
    RubyMethodCall, RubyArrayLiteral, RubyHashLiteral, RubyRange,
    RubyStringInterpolation, RubyBlockExpression, RubyLambda, RubyIndex,
    RubyConditional, RubySplat, RubyConstantAccess, RubyYield, RubySuper,
    RubyDocComment, RubyConstant, RubyRawCode
  } = RubyAST;

  /**
   * Maps JavaScript/JSDoc types to Ruby types
   */
  const TYPE_MAP = {
    // Integer types
    'uint8': 'Integer', 'byte': 'Integer',
    'uint16': 'Integer', 'ushort': 'Integer', 'word': 'Integer',
    'uint32': 'Integer', 'uint': 'Integer', 'dword': 'Integer',
    'uint64': 'Integer', 'ulong': 'Integer', 'qword': 'Integer',
    'int8': 'Integer', 'sbyte': 'Integer',
    'int16': 'Integer', 'short': 'Integer',
    'int32': 'Integer', 'int': 'Integer',
    'int64': 'Integer', 'long': 'Integer',
    // Floating point
    'float': 'Float', 'float32': 'Float',
    'double': 'Float', 'float64': 'Float',
    'number': 'Integer', // In crypto context, typically integer operations
    // Other
    'boolean': 'TrueClass', 'bool': 'TrueClass',
    'string': 'String', 'String': 'String',
    'void': 'NilClass',
    'object': 'Hash',
    'Array': 'Array'
  };

  /**
   * JavaScript AST to Ruby AST Transformer
   *
   * Supported Options:
   * - indent: string - Indentation string (default: '  ')
   * - lineEnding: string - Line ending character (default: '\n')
   * - addComments: boolean - Add documentation comments. Default: true
   * - useFrozenStringLiteral: boolean - Add frozen_string_literal magic comment. Default: true
   * - useSymbolKeys: boolean - Use symbols for hash keys. Default: true
   * - useModernSyntax: boolean - Use Ruby 3+ syntax features. Default: true
   */
  class RubyTransformer {
    constructor(options = {}) {
      this.options = options;
      this.currentClass = null;
      this.variableTypes = new Map();
      this.scopeStack = [];
      this.requires = new Set();

      // Track framework classes needed for stub generation
      this.frameworkClasses = new Set(); // Base classes used (BlockCipherAlgorithm, etc.)
      this.helperClasses = new Set();    // Helper classes (KeySize, LinkItem, etc.)
      this.enumsUsed = new Set();        // Enums referenced (category_type, etc.)
      this.frameworkFunctions = new Set(); // Framework functions (register_algorithm, etc.)
    }

    /**
     * Convert a Ruby AST node to its source code string representation.
     * Used when embedding transformed expressions into raw code strings
     * (e.g., string interpolation) where a text form is needed.
     */
    _nodeToCode(node) {
      if (!node) return '';
      if (typeof node === 'string') return node;
      try {
        const emitter = new RubyEmitter({ indent: '', newline: '', addComments: false });
        return emitter.emit(node);
      } catch (e) {
        return String(node);
      }
    }

    /**
     * Convert name to snake_case (Ruby convention for methods/variables)
     */
    toSnakeCase(str) {
      if (!str) return str;
      if (typeof str !== 'string') str = String(str);
      return str
        .replace(/([A-Z])/g, '_$1')  // CamelCase to snake_case
        .replace(/[-\s]+/g, '_')     // Replace hyphens and spaces with underscores
        .toLowerCase()
        .replace(/^_/, '')           // Remove leading underscore
        .replace(/_+/g, '_');        // Collapse multiple underscores
    }

    /**
     * Sanitize an identifier name for Ruby
     * Removes invalid characters and ensures valid Ruby identifier
     */
    sanitizeRubyIdentifier(str) {
      if (!str) return str;
      if (typeof str !== 'string') str = String(str);

      // Remove quotes if present
      str = str.replace(/^['"]|['"]$/g, '');

      // Replace invalid characters with underscores
      str = str.replace(/[^a-zA-Z0-9_]/g, '_');

      // Ensure doesn't start with digit
      if (/^\d/.test(str)) str = '_' + str;

      // Collapse multiple underscores
      str = str.replace(/_+/g, '_');

      // Remove leading/trailing underscores
      str = str.replace(/^_|_$/g, '');

      return str || 'unnamed';
    }

    /**
     * Extract property name from AST node
     * Handles both IL AST (string) and JS AST (object with name/value) formats
     */
    getPropertyName(property) {
      if (!property) return undefined;
      if (typeof property === 'string') return property;
      return property.name || property.value;
    }

    /**
     * Convert name to CamelCase (Ruby convention for classes/modules)
     */
    toCamelCase(str) {
      if (!str) return str;
      return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Convert name to SCREAMING_SNAKE_CASE (Ruby convention for constants)
     */
    toScreamingSnakeCase(str) {
      if (!str) return str;
      if (typeof str !== 'string') str = String(str);
      return str
        .replace(/([A-Z])/g, '_$1')
        .toUpperCase()
        .replace(/^_/, '');
    }

    /**
     * Map JavaScript type string to Ruby type
     */
    mapType(typeName) {
      if (!typeName) return RubyType.Integer();

      // Handle arrays
      if (typeName.endsWith('[]')) {
        const elementTypeName = typeName.slice(0, -2);
        const elementType = this.mapType(elementTypeName);
        return RubyType.Array(elementType);
      }

      const rubyTypeName = TYPE_MAP[typeName] || typeName;

      const typeMap = {
        'Integer': RubyType.Integer(),
        'Float': RubyType.Float(),
        'String': RubyType.String(),
        'Symbol': RubyType.Symbol(),
        'TrueClass': RubyType.TrueClass(),
        'FalseClass': RubyType.FalseClass(),
        'NilClass': RubyType.NilClass()
      };

      return typeMap[rubyTypeName] || new RubyType(rubyTypeName);
    }

    /**
     * Register a variable's type
     */
    registerVariableType(name, type) {
      this.variableTypes.set(name, type);
    }

    /**
     * Get a registered variable's type
     */
    getVariableType(name) {
      return this.variableTypes.get(name) || null;
    }

    /**
     * Push a new scope
     */
    pushScope() {
      this.scopeStack.push(new Map(this.variableTypes));
    }

    /**
     * Pop scope
     */
    popScope() {
      if (this.scopeStack.length > 0) {
        this.variableTypes = this.scopeStack.pop();
      }
    }

    /**
     * Infer Ruby type from variable name pattern
     */
    inferTypeFromName(name) {
      if (!name) return RubyType.Integer();

      const lowerName = name.toLowerCase();

      // Byte-related names
      if (lowerName.includes('byte') || lowerName === 'b' || /^b\d$/.test(lowerName)) {
        return RubyType.Integer();
      }

      // Array-related names
      if (lowerName.includes('key') || lowerName.includes('data') ||
          lowerName.includes('input') || lowerName.includes('output') ||
          lowerName.includes('block') || lowerName.includes('bytes') ||
          lowerName.includes('buffer') || lowerName.includes('state')) {
        return RubyType.Array(RubyType.Integer());
      }

      // Index/length names
      if (lowerName.includes('index') || lowerName.includes('length') ||
          lowerName.includes('size') || lowerName.includes('count') ||
          lowerName === 'i' || lowerName === 'j' || lowerName === 'n') {
        return RubyType.Integer();
      }

      return RubyType.Integer();
    }

    /**
     * Transform a JavaScript AST to a Ruby AST
     */
    transform(jsAst) {
      const module = new RubyModule();

      // Add frozen_string_literal magic comment
      if (this.options.useFrozenStringLiteral !== false) {
        module.magicComments.push(
          new RubyMagicComment('frozen_string_literal', 'true')
        );
      }

      // Add module doc comment
      if (this.options.addComments !== false) {
        const docComment = new RubyDocComment(
          'Generated Ruby code from JavaScript AST\nThis file was automatically generated',
          true
        );
        module.docComment = docComment;
      }

      // Transform the JavaScript AST
      if (jsAst.type === 'Program') {
        for (const node of jsAst.body) {
          this.transformTopLevel(node, module);
        }
      }

      // Generate framework stub classes at the beginning of module
      const stubs = this.generateFrameworkStubs();
      if (stubs.length > 0) {
        module.items = [...stubs, ...module.items];
      }

      return module;
    }

    /**
     * Generate stub classes for AlgorithmFramework classes used in inheritance
     */
    generateFrameworkStubs() {
      const stubs = [];

      // Framework base class stub definitions (Ruby syntax)
      const FRAMEWORK_STUBS = {
        'BlockCipherAlgorithm': 'class BlockCipherAlgorithm\nend',
        'StreamCipherAlgorithm': 'class StreamCipherAlgorithm\nend',
        'HashFunctionAlgorithm': 'class HashFunctionAlgorithm\nend',
        'AsymmetricAlgorithm': 'class AsymmetricAlgorithm\nend',
        'MacAlgorithm': 'class MacAlgorithm\nend',
        'KdfAlgorithm': 'class KdfAlgorithm\nend',
        'EncodingAlgorithm': 'class EncodingAlgorithm\nend',
        'CompressionAlgorithm': 'class CompressionAlgorithm\nend',
        'ChecksumAlgorithm': 'class ChecksumAlgorithm\nend',
        'ClassicalCipherAlgorithm': 'class ClassicalCipherAlgorithm\nend',
        'IBlockCipherInstance': 'class IBlockCipherInstance\n  def initialize(algorithm)\n    @algorithm = algorithm\n  end\nend',
        'IStreamCipherInstance': 'class IStreamCipherInstance\n  def initialize(algorithm)\n    @algorithm = algorithm\n  end\nend',
        'IHashFunctionInstance': 'class IHashFunctionInstance\n  def initialize(algorithm)\n    @algorithm = algorithm\n  end\nend',
        'IAlgorithmInstance': 'class IAlgorithmInstance\n  def initialize(algorithm)\n    @algorithm = algorithm\n  end\nend',
      };

      // Helper classes
      const HELPER_STUBS = {
        'KeySize': 'class KeySize\n  attr_accessor :min_size, :max_size, :step\n  def initialize(min_size, max_size, step)\n    @min_size = min_size\n    @max_size = max_size\n    @step = step\n  end\nend',
        'LinkItem': 'class LinkItem\n  attr_accessor :text, :url\n  def initialize(text, url)\n    @text = text\n    @url = url\n  end\nend',
        'Vulnerability': 'class Vulnerability\n  attr_accessor :name, :description, :mitigation\n  def initialize(name, description, mitigation)\n    @name = name\n    @description = description\n    @mitigation = mitigation\n  end\nend',
        'TestCase': 'class TestCase\n  attr_accessor :input, :expected, :key, :iv, :text, :uri\n  def initialize(**kwargs)\n    kwargs.each { |k, v| instance_variable_set("@#{k}", v) }\n  end\nend',
      };

      // Enum constants
      const ENUM_STUBS = {
        'category_type': 'module CategoryType\n  BLOCK = :block\n  STREAM = :stream\n  HASH = :hash\n  ASYMMETRIC = :asymmetric\n  MAC = :mac\n  KDF = :kdf\n  ENCODING = :encoding\n  COMPRESSION = :compression\n  CHECKSUM = :checksum\n  CLASSICAL = :classical\nend\ncategory_type = CategoryType',
        'security_status': 'module SecurityStatus\n  SECURE = :secure\n  BROKEN = :broken\n  DEPRECATED = :deprecated\n  EXPERIMENTAL = :experimental\n  EDUCATIONAL = :educational\nend\nsecurity_status = SecurityStatus',
        'complexity_type': 'module ComplexityType\n  BEGINNER = :beginner\n  INTERMEDIATE = :intermediate\n  ADVANCED = :advanced\n  EXPERT = :expert\nend\ncomplexity_type = ComplexityType',
        'country_code': 'module CountryCode\n  US = :us\n  GB = :gb\n  DE = :de\n  FR = :fr\n  JP = :jp\n  CN = :cn\n  RU = :ru\n  IL = :il\n  BE = :be\n  KR = :kr\nend\ncountry_code = CountryCode',
      };

      // Check which framework classes are needed
      for (const baseClass of this.frameworkClasses) {
        if (FRAMEWORK_STUBS[baseClass]) {
          stubs.push({ nodeType: 'RawCode', code: FRAMEWORK_STUBS[baseClass] });
        }
      }

      // Check for helper classes usage
      for (const helper of this.helperClasses) {
        if (HELPER_STUBS[helper]) {
          stubs.push({ nodeType: 'RawCode', code: HELPER_STUBS[helper] });
        }
      }

      // Check for enum usage
      for (const enumName of this.enumsUsed) {
        if (ENUM_STUBS[enumName]) {
          stubs.push({ nodeType: 'RawCode', code: ENUM_STUBS[enumName] });
        }
      }

      // Add framework functions at the end
      if (this.frameworkFunctions.has('register_algorithm')) {
        stubs.push({ nodeType: 'RawCode', code: 'def register_algorithm(algo)\nend' });
      }
      if (this.frameworkFunctions.has('algorithm_framework')) {
        stubs.push({ nodeType: 'RawCode', code: 'class AlgorithmFramework\n  def self.find(name)\n    nil\n  end\nend\nalgorithm_framework = AlgorithmFramework' });
      }

      return stubs;
    }

    /**
     * Transform a top-level JavaScript node
     */
    transformTopLevel(node, targetModule) {
      switch (node.type) {
        case 'VariableDeclaration':
          this.transformVariableDeclaration(node, targetModule);
          break;

        case 'FunctionDeclaration':
          this.transformFunctionDeclaration(node, targetModule);
          break;

        case 'ClassDeclaration':
          this.transformClassDeclaration(node, targetModule);
          break;

        case 'ExpressionStatement':
          // Handle IIFE wrappers
          if (node.expression.type === 'CallExpression') {
            const callee = node.expression.callee;
            if (callee.type === 'FunctionExpression' ||
                callee.type === 'ArrowFunctionExpression') {
              this.transformIIFEContent(callee, node.expression, targetModule);
            }
          }
          break;

        default:
          break;
      }
    }

    /**
     * Extract and transform content from IIFE wrapper
     */
    transformIIFEContent(calleeNode, callExpr, targetModule) {
      let bodyStatements = [];

      // UMD pattern: second argument is factory function
      if (callExpr && callExpr.arguments && callExpr.arguments.length >= 2) {
        const factoryArg = callExpr.arguments[1];
        if (factoryArg.type === 'FunctionExpression' || factoryArg.type === 'ArrowFunctionExpression') {
          bodyStatements = factoryArg.body?.body || [];
        }
      }

      // Simple IIFE pattern
      if (bodyStatements.length === 0 && calleeNode.body && calleeNode.body.body) {
        bodyStatements = calleeNode.body.body;
      }

      // Process statements
      for (const stmt of bodyStatements) {
        if (stmt.type === 'ExpressionStatement') continue;
        if (stmt.type === 'ClassDeclaration') {
          this.transformClassDeclaration(stmt, targetModule);
          continue;
        }
        if (stmt.type === 'FunctionDeclaration') {
          this.transformFunctionDeclaration(stmt, targetModule);
          continue;
        }
        if (stmt.type === 'VariableDeclaration') {
          this.transformVariableDeclaration(stmt, targetModule);
          continue;
        }
        if (stmt.type === 'IfStatement') continue;
      }
    }

    /**
     * Transform a variable declaration
     */
    transformVariableDeclaration(node, targetModule) {
      for (const decl of node.declarations) {
        if (!decl.init) continue;

        if (decl.id.type === 'ObjectPattern') continue;

        // Handle array destructuring: const [a, b, c] = arr;
        // Ruby supports multiple assignment: a, b, c = arr
        if (decl.id.type === 'ArrayPattern') {
          const sourceExpr = decl.init ? this.transformExpression(decl.init) : null;
          if (sourceExpr) {
            for (let i = 0; i < decl.id.elements.length; ++i) {
              const elem = decl.id.elements[i];
              if (!elem) continue; // Skip holes in destructuring

              const varName = this.toSnakeCase(elem.name);
              const indexExpr = new RubyArrayAccess(sourceExpr, RubyLiteral.Integer(i));
              const constDecl = new RubyConstant(this.toScreamingSnakeCase(elem.name), indexExpr);
              targetModule.items.push(constDecl);
            }
          }
          continue;
        }

        const name = decl.id.name;

        // Check for class-like objects
        if (decl.init.type === 'ObjectExpression') {
          const rubyClass = this.transformObjectToClass(name, decl.init);
          if (rubyClass) {
            targetModule.items.push(rubyClass);
          }
        }
        // Simple constants
        else if (decl.init.type === 'Literal' ||
                 decl.init.type === 'ArrayExpression' ||
                 decl.init.type === 'UnaryExpression' ||
                 decl.init.type === 'BinaryExpression') {
          const constDecl = new RubyConstant(
            this.toScreamingSnakeCase(name),
            this.transformExpression(decl.init)
          );
          targetModule.items.push(constDecl);
        }
      }
    }

    /**
     * Transform an object literal to a Ruby class
     */
    transformObjectToClass(name, objNode) {
      const rubyClass = new RubyClass(this.toCamelCase(name));

      const prevClass = this.currentClass;
      this.currentClass = rubyClass;

      for (const prop of objNode.properties) {
        const propName = prop.key.name || prop.key.value;
        const propValue = prop.value;

        if (prop.method || propValue.type === 'FunctionExpression' || propValue.type === 'ArrowFunctionExpression') {
          // Method
          const method = this.transformFunctionToMethod(propName, propValue);
          rubyClass.methods.push(method);
        } else {
          // Class variable - sanitize name for valid Ruby identifier
          const sanitizedName = this.sanitizeRubyIdentifier(this.toSnakeCase(propName));
          const identifier = new RubyIdentifier(sanitizedName);
          identifier.isClass = true;
          const assignment = new RubyAssignment(
            identifier,
            this.transformExpression(propValue)
          );
          rubyClass.classVariables.push(assignment);
        }
      }

      this.currentClass = prevClass;
      return rubyClass;
    }

    /**
     * Transform a function declaration
     */
    transformFunctionDeclaration(node, targetModule) {
      const funcName = this.toSnakeCase(node.id.name);
      const func = new RubyMethod(funcName);

      // Parameters
      if (node.params) {
        for (const param of node.params) {
          const paramName = this.toSnakeCase(param.name);
          const paramType = this.inferTypeFromName(param.name);
          const rubyParam = new RubyParameter(paramName, paramType);
          func.parameters.push(rubyParam);

          this.registerVariableType(param.name, paramType);
        }
      }

      // Body
      if (node.body) {
        func.body = this.transformBlockStatement(node.body);
      }

      targetModule.items.push(func);
    }

    /**
     * Transform a function to a method
     */
    transformFunctionToMethod(name, funcNode) {
      const methodName = this.toSnakeCase(name);
      const method = new RubyMethod(methodName);

      // Parameters
      if (funcNode.params) {
        for (const param of funcNode.params) {
          const paramName = this.toSnakeCase(param.name);
          const paramType = this.inferTypeFromName(param.name);
          const rubyParam = new RubyParameter(paramName, paramType);
          method.parameters.push(rubyParam);

          this.registerVariableType(param.name, paramType);
        }
      }

      // Body
      if (funcNode.body) {
        method.body = this.transformBlockStatement(funcNode.body);
      }

      return method;
    }

    /**
     * Transform a class declaration to a Ruby class
     */
    transformClassDeclaration(node, targetModule) {
      const className = this.toCamelCase(node.id.name);
      const rubyClass = new RubyClass(className);

      // Known framework base classes
      const FRAMEWORK_CLASSES = new Set([
        'BlockCipherAlgorithm', 'StreamCipherAlgorithm', 'HashFunctionAlgorithm',
        'AsymmetricAlgorithm', 'MacAlgorithm', 'KdfAlgorithm', 'EncodingAlgorithm',
        'CompressionAlgorithm', 'ChecksumAlgorithm', 'ClassicalCipherAlgorithm',
        'IBlockCipherInstance', 'IStreamCipherInstance',
        'IHashFunctionInstance', 'IAlgorithmInstance'
      ]);

      // Handle class inheritance (extends)
      if (node.superClass) {
        let baseName;
        // Handle both Identifier and MemberExpression (e.g., AlgorithmFramework.BlockCipherAlgorithm)
        if (node.superClass.type === 'MemberExpression') {
          baseName = node.superClass.property.name || node.superClass.property.value;
        } else {
          baseName = node.superClass.name || node.superClass;
        }

        if (baseName) {
          const baseClassName = typeof baseName === 'string' ? baseName : baseName.name || 'Object';
          rubyClass.superclass = this.toCamelCase(baseClassName);

          // Track framework classes for stub generation
          if (FRAMEWORK_CLASSES.has(baseClassName))
            this.frameworkClasses.add(baseClassName);
        }
      }

      const prevClass = this.currentClass;
      this.currentClass = rubyClass;

      const members = node.body?.body || node.body || [];

      if (members && members.length > 0) {
        const instanceVars = [];

        for (const member of members) {
          if (member.type === 'MethodDefinition') {
            if (member.kind === 'constructor') {
              // Extract instance variables from constructor
              const { fields, initStatements } = this.extractFieldsFromConstructor(member);
              instanceVars.push(...fields);

              // Create initialize method
              const initMethod = this.transformConstructor(member, initStatements, fields);
              rubyClass.methods.push(initMethod);
            } else {
              // Regular method
              const method = this.transformMethodDefinition(member);
              rubyClass.methods.push(method);
            }
          } else if (member.type === 'PropertyDefinition') {
            // Field
            const fieldName = this.toSnakeCase(member.key.name);
            instanceVars.push(fieldName);
          } else if (member.type === 'StaticBlock') {
            // ES2022 static block -> Ruby module-level statements
            const initStatements = this.transformStaticBlock(member);
            if (initStatements) {
              rubyClass.staticInitStatements = rubyClass.staticInitStatements || [];
              rubyClass.staticInitStatements.push(...initStatements);
            }
          }
        }

        // Add attr_accessor for instance variables
        if (instanceVars.length > 0) {
          const symbols = instanceVars.map(name => `:${name}`);
          rubyClass.attributes.push(new RubyAttribute('accessor', symbols));
        }
      }

      this.currentClass = prevClass;

      targetModule.items.push(rubyClass);
    }

    /**
     * Check if a statement is a this.property = value assignment
     * Handles both JS AST (MemberExpression) and IL AST (ThisPropertyAccess) formats
     */
    isThisPropertyAssignment(stmt) {
      if (stmt.type !== 'ExpressionStatement') return false;
      const expr = stmt.expression;
      if (expr.type !== 'AssignmentExpression') return false;

      // IL AST format: { type: 'ThisPropertyAccess', property: 'propName' }
      if (expr.left.type === 'ThisPropertyAccess') return true;

      // JS AST format: { type: 'MemberExpression', object: { type: 'ThisExpression' }, property: {...} }
      if (expr.left.type === 'MemberExpression' && expr.left.object?.type === 'ThisExpression') return true;

      return false;
    }

    /**
     * Extract property name from this.property assignment left-hand side
     * Handles both JS AST and IL AST formats
     */
    getThisPropertyName(leftNode) {
      // IL AST format: { type: 'ThisPropertyAccess', property: 'propName' }
      if (leftNode.type === 'ThisPropertyAccess') {
        return typeof leftNode.property === 'string'
          ? leftNode.property
          : (leftNode.property?.name || leftNode.property?.value);
      }

      // JS AST format: { type: 'MemberExpression', property: { name: 'propName' } }
      if (leftNode.type === 'MemberExpression') {
        return typeof leftNode.property === 'string'
          ? leftNode.property
          : (leftNode.property?.name || leftNode.property?.value);
      }

      return undefined;
    }

    /**
     * Extract fields from constructor's this.x = y assignments
     */
    extractFieldsFromConstructor(node) {
      const fields = [];
      const initStatements = [];

      if (!node.value || !node.value.body || node.value.body.type !== 'BlockStatement')
        return { fields, initStatements };

      for (const stmt of node.value.body.body) {
        if (this.isThisPropertyAssignment(stmt)) {
          const expr = stmt.expression;
          const propName = this.getThisPropertyName(expr.left);

          let fieldName = this.toSnakeCase(propName);
          if (fieldName.startsWith('_')) fieldName = fieldName.substring(1);

          fields.push(fieldName);
          initStatements.push(stmt);
        }
      }

      return { fields, initStatements };
    }

    /**
     * Transform a constructor to an initialize method
     */
    transformConstructor(node, fieldInitStatements = [], fields = []) {
      const initMethod = new RubyMethod('initialize');

      // Parameters
      if (node.value && node.value.params) {
        for (const param of node.value.params) {
          const paramName = this.toSnakeCase(param.name);
          const paramType = this.inferTypeFromName(param.name);
          const rubyParam = new RubyParameter(paramName, paramType);
          initMethod.parameters.push(rubyParam);

          this.registerVariableType(param.name, paramType);
        }
      }

      const body = new RubyBlock();

      if (node.value && node.value.body && node.value.body.type === 'BlockStatement') {
        for (const stmt of node.value.body.body) {
          if (this.isThisPropertyAssignment(stmt)) {
            // Transform to @variable assignment
            const expr = stmt.expression;
            const propName = this.getThisPropertyName(expr.left);
            let fieldName = this.toSnakeCase(propName);
            if (fieldName.startsWith('_')) fieldName = fieldName.substring(1);

            const identifier = new RubyIdentifier(fieldName);
            identifier.isInstance = true;

            const assignment = new RubyAssignment(
              identifier,
              this.transformExpression(expr.right)
            );
            body.statements.push(assignment);
          } else {
            const rubyStmt = this.transformStatement(stmt);
            if (rubyStmt) {
              if (Array.isArray(rubyStmt))
                body.statements.push(...rubyStmt);
              else
                body.statements.push(rubyStmt);
            }
          }
        }
      }

      initMethod.body = body;
      return initMethod;
    }

    /**
     * Transform a method definition
     */
    transformStaticBlock(node) {
      // ES2022 static block -> Ruby module-level statements
      // Ruby doesn't have static class blocks, so transform to statements
      // Handle both array body and object with body property
      const statements = Array.isArray(node.body) ? node.body :
                         (node.body?.body && Array.isArray(node.body.body)) ? node.body.body : [];
      return statements.map(stmt => this.transformStatement(stmt));
    }

    transformClassExpression(node) {
      // ClassExpression -> Ruby Class.new or inline class
      // Class.new(ParentClass) { ... }
      const parentArg = node.superClass
        ? [this.transformExpression(node.superClass)]
        : [];

      const classNew = new RubyMethodCall(
        new RubyIdentifier('Class'),
        'new',
        parentArg
      );

      // Add block with class body if present
      if (node.body?.body && node.body.body.length > 0) {
        classNew.block = new RubyBlock();
        for (const member of node.body.body) {
          const transformed = this.transformClassMember(member);
          if (transformed)
            classNew.block.statements.push(transformed);
        }
      }

      return classNew;
    }

    transformYieldExpression(node) {
      // Ruby's yield calls a block - different from JS generators
      // For closest approximation, use Enumerator::Yielder
      const argument = node.argument ? this.transformExpression(node.argument) : RubyLiteral.Nil();
      return new RubyYield(argument);
    }

    transformMethodDefinition(node) {
      const methodName = this.toSnakeCase(node.key.name);
      const method = new RubyMethod(methodName);

      method.isClassMethod = node.static;

      // Parameters
      if (node.value && node.value.params) {
        for (const param of node.value.params) {
          const paramName = this.toSnakeCase(param.name);
          const paramType = this.inferTypeFromName(param.name);
          const rubyParam = new RubyParameter(paramName, paramType);
          method.parameters.push(rubyParam);

          this.registerVariableType(param.name, paramType);
        }
      }

      // Body
      if (node.value && node.value.body) {
        method.body = this.transformBlockStatement(node.value.body);
      }

      return method;
    }

    /**
     * Transform a block statement
     */
    transformBlockStatement(node) {
      const block = new RubyBlock();

      if (node.body && Array.isArray(node.body)) {
        for (const stmt of node.body) {
          const rubyStmt = this.transformStatement(stmt);
          if (rubyStmt) {
            if (Array.isArray(rubyStmt)) {
              block.statements.push(...rubyStmt);
            } else {
              block.statements.push(rubyStmt);
            }
          }
        }
      }

      return block;
    }

    /**
     * Transform a statement (handles all 16+ critical statement types)
     */
    transformStatement(node) {
      if (!node) return null;

      switch (node.type) {
        case 'VariableDeclaration':
          return this.transformLetStatement(node);

        case 'ExpressionStatement':
          return this.transformExpressionStatementNode(node);

        case 'ReturnStatement':
          return this.transformReturnStatement(node);

        case 'IfStatement':
          return this.transformIfStatement(node);

        case 'ForStatement':
          return this.transformForStatement(node);

        case 'ForOfStatement':
          return this.transformForOfStatement(node);

        case 'ForInStatement':
          return this.transformForInStatement(node);

        case 'WhileStatement':
          return this.transformWhileStatement(node);

        case 'DoWhileStatement':
          return this.transformDoWhileStatement(node);

        case 'SwitchStatement':
          return this.transformSwitchStatement(node);

        case 'TryStatement':
          return this.transformTryStatement(node);

        case 'ThrowStatement':
          return this.transformThrowStatement(node);

        case 'BlockStatement':
          return this.transformBlockStatement(node);

        case 'BreakStatement':
          return new RubyBreak();

        case 'ContinueStatement':
          return new RubyNext();

        default:
          return null;
      }
    }

    /**
     * Transform a do-while statement
     */
    transformDoWhileStatement(node) {
      // Ruby: loop do ... break unless condition end
      const body = this.transformStatement(node.body) || new RubyBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      const condition = this.transformExpression(node.test);
      const breakUnless = new RubyIf(condition, new RubyBlock([new RubyBreak()]), null);
      breakUnless.isUnless = true;
      bodyBlock.statements.push(breakUnless);

      return new RubyLoop(bodyBlock);
    }

    /**
     * Transform a switch statement to case/when
     * Note: Ruby case/when doesn't need break statements - unlike JS, Ruby doesn't fall through
     */
    transformSwitchStatement(node) {
      const discriminant = this.transformExpression(node.discriminant);
      const caseStmt = new RubyCase(discriminant);

      for (const caseNode of node.cases) {
        if (caseNode.test) {
          const pattern = this.transformExpression(caseNode.test);
          const whenBody = new RubyBlock();

          for (const stmt of caseNode.consequent) {
            // Skip break statements - Ruby case/when doesn't need them
            if (stmt.type === 'BreakStatement') continue;

            const rubyStmt = this.transformStatement(stmt);
            if (rubyStmt) {
              if (Array.isArray(rubyStmt)) {
                whenBody.statements.push(...rubyStmt);
              } else {
                whenBody.statements.push(rubyStmt);
              }
            }
          }

          const whenClause = new RubyWhen([pattern], whenBody);
          caseStmt.whenBranches.push(whenClause);
        } else {
          // Default case (else)
          const elseBody = new RubyBlock();
          for (const stmt of caseNode.consequent) {
            // Skip break statements - Ruby case/when doesn't need them
            if (stmt.type === 'BreakStatement') continue;

            const rubyStmt = this.transformStatement(stmt);
            if (rubyStmt) {
              if (Array.isArray(rubyStmt)) {
                elseBody.statements.push(...rubyStmt);
              } else {
                elseBody.statements.push(rubyStmt);
              }
            }
          }
          caseStmt.elseBranch = elseBody;
        }
      }

      return caseStmt;
    }

    /**
     * Transform a try-catch statement to begin/rescue
     */
    transformTryStatement(node) {
      const beginBlock = new RubyBegin();
      beginBlock.tryBlock = this.transformStatement(node.block);

      if (node.handler) {
        const exceptionType = node.handler.param ? null : ['StandardError'];
        const varName = node.handler.param ? this.toSnakeCase(node.handler.param.name) : 'e';
        const rescueBody = this.transformStatement(node.handler.body);

        const rescueClause = new RubyRescue(exceptionType, varName, rescueBody);
        beginBlock.rescueClauses.push(rescueClause);
      }

      if (node.finalizer) {
        beginBlock.ensureBlock = this.transformStatement(node.finalizer);
      }

      return beginBlock;
    }

    /**
     * Transform a throw statement to raise
     */
    transformThrowStatement(node) {
      const expr = node.argument ? this.transformExpression(node.argument) : RubyLiteral.String('error');
      return new RubyRaise(RubyLiteral.String('StandardError'), expr);
    }

    /**
     * Transform a let statement
     */
    transformLetStatement(node) {
      const statements = [];

      for (const decl of node.declarations) {
        const varName = this.toSnakeCase(decl.id.name);
        let initializer = null;

        if (decl.init) {
          initializer = this.transformExpression(decl.init);
        }

        const assignment = new RubyAssignment(
          new RubyIdentifier(varName),
          initializer || RubyLiteral.Nil()
        );

        statements.push(assignment);
      }

      return statements;
    }

    /**
     * Transform an expression statement
     */
    transformExpressionStatementNode(node) {
      const expr = this.transformExpression(node.expression);
      if (!expr) return null;

      return new RubyExpressionStatement(expr);
    }

    /**
     * Transform a return statement
     */
    transformReturnStatement(node) {
      if (node.argument) {
        const expr = this.transformExpression(node.argument);
        return new RubyReturn(expr);
      }

      return new RubyReturn();
    }

    /**
     * Transform an if statement
     */
    transformIfStatement(node) {
      const condition = this.transformExpression(node.test);
      const thenBranch = this.transformStatement(node.consequent) || new RubyBlock();
      const elseBranch = node.alternate ? this.transformStatement(node.alternate) : null;

      const thenBlock = thenBranch.nodeType === 'Block' ? thenBranch : this.wrapInBlock(thenBranch);
      const elseBlock = elseBranch ? (elseBranch.nodeType === 'Block' ? elseBranch : this.wrapInBlock(elseBranch)) : null;

      return new RubyIf(condition, thenBlock, [], elseBlock);
    }

    /**
     * Transform a for statement
     */
    transformForStatement(node) {
      // Convert to while loop
      const whileLoop = new RubyWhile(
        node.test ? this.transformExpression(node.test) : RubyLiteral.True(),
        this.transformStatement(node.body) || new RubyBlock()
      );

      const statements = [];
      if (node.init) {
        const initStmt = this.transformStatement(node.init);
        if (initStmt) {
          if (Array.isArray(initStmt)) {
            statements.push(...initStmt);
          } else {
            statements.push(initStmt);
          }
        }
      }

      statements.push(whileLoop);

      if (node.update && whileLoop.body.nodeType === 'Block') {
        const updateStmt = new RubyExpressionStatement(this.transformExpression(node.update));
        whileLoop.body.statements.push(updateStmt);
      }

      return statements.length === 1 ? statements[0] : statements;
    }

    /**
     * Transform a while statement
     */
    transformWhileStatement(node) {
      const condition = this.transformExpression(node.test);
      const body = this.transformStatement(node.body) || new RubyBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      return new RubyWhile(condition, bodyBlock);
    }

    /**
     * Transform a for-of statement
     */
    transformForOfStatement(node) {
      let varName = 'item';
      if (node.left.type === 'VariableDeclaration') {
        const decl = node.left.declarations[0];
        if (decl && decl.id) {
          varName = this.toSnakeCase(decl.id.name);
        }
      } else if (node.left.type === 'Identifier') {
        varName = this.toSnakeCase(node.left.name);
      }

      const iterable = this.transformExpression(node.right);
      const body = this.transformStatement(node.body) || new RubyBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      // Use .each block instead of for loop
      const eachCall = new RubyMethodCall(
        iterable,
        'each',
        [],
        new RubyBlockExpression(
          [new RubyParameter(varName)],
          bodyBlock
        )
      );

      return new RubyExpressionStatement(eachCall);
    }

    /**
     * Transform a for-in statement
     */
    transformForInStatement(node) {
      let varName = 'key';
      if (node.left.type === 'VariableDeclaration') {
        const decl = node.left.declarations[0];
        if (decl && decl.id) {
          varName = this.toSnakeCase(decl.id.name);
        }
      } else if (node.left.type === 'Identifier') {
        varName = this.toSnakeCase(node.left.name);
      }

      const object = this.transformExpression(node.right);
      const keysCall = new RubyMethodCall(object, 'keys', []);

      const body = this.transformStatement(node.body) || new RubyBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      const eachCall = new RubyMethodCall(
        keysCall,
        'each',
        [],
        new RubyBlockExpression(
          [new RubyParameter(varName)],
          bodyBlock
        )
      );

      return new RubyExpressionStatement(eachCall);
    }

    /**
     * Wrap a statement in a block
     */
    wrapInBlock(stmt) {
      const block = new RubyBlock();
      if (stmt) {
        if (Array.isArray(stmt)) {
          block.statements.push(...stmt);
        } else {
          block.statements.push(stmt);
        }
      }
      return block;
    }

    /**
     * Transform an expression (handles all 19+ critical expression types)
     */
    transformExpression(node) {
      if (!node) return null;

      switch (node.type) {
        case 'Literal':
          return this.transformLiteral(node);

        case 'Identifier':
          return this.transformIdentifier(node);

        case 'BinaryExpression':
        case 'LogicalExpression':
          return this.transformBinaryExpression(node);

        case 'UnaryExpression':
          return this.transformUnaryExpression(node);

        case 'AssignmentExpression':
          return this.transformAssignmentExpression(node);

        case 'UpdateExpression':
          return this.transformUpdateExpression(node);

        case 'MemberExpression':
          return this.transformMemberExpression(node);

        case 'CallExpression':
          return this.transformCallExpression(node);

        case 'ArrayExpression':
          return this.transformArrayExpression(node);

        case 'ObjectExpression':
          return this.transformObjectExpression(node);

        case 'NewExpression':
          return this.transformNewExpression(node);

        case 'ThisExpression':
          return new RubyIdentifier('self');

        case 'ThisPropertyAccess':
          // IL AST: this.property -> @property in Ruby
          {
            const propName = this.getPropertyName(node.property);
            let fieldName = this.toSnakeCase(propName);
            if (fieldName && fieldName.startsWith('_')) fieldName = fieldName.substring(1);
            const identifier = new RubyIdentifier(fieldName || 'unknown');
            identifier.isInstance = true;
            return identifier;
          }

        // ========================[ IL AST NODE TYPES ]========================
        // These are normalized IL nodes from type-aware-transpiler.js

        case 'ParentConstructorCall':
          return this.transformParentConstructorCall(node);

        case 'ParentMethodCall':
          return this.transformParentMethodCall(node);

        case 'ThisMethodCall':
          return this.transformThisMethodCall(node);

        case 'OpCodesCall':
          return this.transformOpCodesCallIL(node);

        case 'RotateLeft':
        case 'RotateRight':
          return this.transformRotation(node);

        case 'PackBytes':
          return this.transformPackBytes(node);

        case 'UnpackBytes':
          return this.transformUnpackBytes(node);

        case 'ArrayLength':
          return this.transformArrayLength(node);

        case 'ArrayAppend':
          return this.transformArrayAppend(node);

        case 'ArraySlice':
          return this.transformArraySlice(node);

        case 'ArrayFill':
          return this.transformArrayFill(node);

        case 'ArrayXor':
          return this.transformArrayXor(node);

        case 'ArrayClear':
          return this.transformArrayClear(node);

        case 'ArrayCreation':
          return this.transformArrayCreation(node);

        case 'TypedArrayCreation':
          return this.transformTypedArrayCreation(node);

        case 'HexDecode':
          return this.transformHexDecode(node);

        case 'HexEncode':
          return this.transformHexEncode(node);

        case 'Floor':
          return new RubyMethodCall(this.transformExpression(node.value), 'floor', []);

        case 'Ceil':
          return new RubyMethodCall(this.transformExpression(node.value), 'ceil', []);

        case 'Abs':
          return new RubyMethodCall(this.transformExpression(node.value), 'abs', []);

        case 'Min':
          return new RubyArrayLiteral((node.values || []).map(v => this.transformExpression(v))).min ?
                 new RubyMethodCall(new RubyArrayLiteral((node.values || []).map(v => this.transformExpression(v))), 'min', []) :
                 new RubyMethodCall(null, 'min', (node.values || []).map(v => this.transformExpression(v)));

        case 'Max':
          return new RubyArrayLiteral((node.values || []).map(v => this.transformExpression(v))).max ?
                 new RubyMethodCall(new RubyArrayLiteral((node.values || []).map(v => this.transformExpression(v))), 'max', []) :
                 new RubyMethodCall(null, 'max', (node.values || []).map(v => this.transformExpression(v)));

        case 'Pow':
          return new RubyBinaryExpression(
            this.transformExpression(node.base),
            '**',
            this.transformExpression(node.exponent)
          );

        case 'Round':
          return new RubyMethodCall(this.transformExpression(node.value), 'round', []);

        case 'Trunc':
          return new RubyMethodCall(this.transformExpression(node.value), 'to_i', []);

        case 'BigIntCast':
          // Ruby handles big integers natively - just transform the argument
          // and use .to_i to ensure it's an integer
          return new RubyMethodCall(this.transformExpression(node.argument), 'to_i', []);

        case 'Sign': {
          // Ruby: value <=> 0
          const value = this.transformExpression(node.value);
          return new RubyBinaryExpression(value, '<=>', RubyLiteral.Integer(0));
        }

        case 'Sqrt':
          return new RubyMethodCall(new RubyConstantAccess('Math'), 'sqrt', [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Cbrt':
          return new RubyMethodCall(new RubyConstantAccess('Math'), 'cbrt', [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Log':
          return new RubyMethodCall(new RubyConstantAccess('Math'), 'log', [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Log2':
          return new RubyMethodCall(new RubyConstantAccess('Math'), 'log2', [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Log10':
          return new RubyMethodCall(new RubyConstantAccess('Math'), 'log10', [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Exp':
          return new RubyMethodCall(new RubyConstantAccess('Math'), 'exp', [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Sin':
          return new RubyMethodCall(new RubyConstantAccess('Math'), 'sin', [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Cos':
          return new RubyMethodCall(new RubyConstantAccess('Math'), 'cos', [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Tan':
          return new RubyMethodCall(new RubyConstantAccess('Math'), 'tan', [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Asin':
          return new RubyMethodCall(new RubyConstantAccess('Math'), 'asin', [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Acos':
          return new RubyMethodCall(new RubyConstantAccess('Math'), 'acos', [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Atan':
          return new RubyMethodCall(new RubyConstantAccess('Math'), 'atan', [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Atan2': {
          const y = this.transformExpression(node.arguments?.[0] || node.y);
          const x = this.transformExpression(node.arguments?.[1] || node.x);
          return new RubyMethodCall(new RubyConstantAccess('Math'), 'atan2', [y, x]);
        }

        case 'Sinh':
          return new RubyMethodCall(new RubyConstantAccess('Math'), 'sinh', [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Cosh':
          return new RubyMethodCall(new RubyConstantAccess('Math'), 'cosh', [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Tanh':
          return new RubyMethodCall(new RubyConstantAccess('Math'), 'tanh', [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Hypot':
          return new RubyMethodCall(new RubyConstantAccess('Math'), 'hypot', (node.arguments || []).map(a => this.transformExpression(a)));

        case 'Fround':
          return new RubyMethodCall(this.transformExpression(node.arguments?.[0] || node.value), 'to_f', []);

        case 'MathConstant': {
          switch (node.name) {
            case 'PI': return new RubyRawCode('Math::PI');
            case 'E': return new RubyRawCode('Math::E');
            case 'LN2': return new RubyMethodCall(new RubyConstantAccess('Math'), 'log', [RubyLiteral.Integer(2)]);
            case 'LN10': return new RubyMethodCall(new RubyConstantAccess('Math'), 'log', [RubyLiteral.Integer(10)]);
            case 'LOG2E': return new RubyMethodCall(new RubyConstantAccess('Math'), 'log2', [new RubyRawCode('Math::E')]);
            case 'LOG10E': return new RubyMethodCall(new RubyConstantAccess('Math'), 'log10', [new RubyRawCode('Math::E')]);
            case 'SQRT2': return new RubyMethodCall(new RubyConstantAccess('Math'), 'sqrt', [RubyLiteral.Integer(2)]);
            case 'SQRT1_2': return new RubyMethodCall(new RubyConstantAccess('Math'), 'sqrt', [RubyLiteral.Float(0.5)]);
            default: return RubyLiteral.Float(node.value);
          }
        }

        case 'NumberConstant': {
          switch (node.name) {
            case 'MAX_SAFE_INTEGER': return RubyLiteral.Integer(9007199254740991);
            case 'MIN_SAFE_INTEGER': return RubyLiteral.Integer(-9007199254740991);
            case 'MAX_VALUE': return new RubyRawCode('Float::MAX');
            case 'MIN_VALUE': return new RubyRawCode('Float::MIN');
            case 'POSITIVE_INFINITY': return new RubyRawCode('Float::INFINITY');
            case 'NEGATIVE_INFINITY': return new RubyRawCode('-Float::INFINITY');
            case 'NaN': return new RubyRawCode('Float::NAN');
            case 'EPSILON': return new RubyRawCode('Float::EPSILON');
            default: return RubyLiteral.Float(node.value);
          }
        }

        case 'InstanceOfCheck': {
          const value = this.transformExpression(node.value);
          const className = typeof node.className === 'string' ? new RubyIdentifier(node.className) : this.transformExpression(node.className);
          return new RubyMethodCall(value, 'is_a?', [className]);
        }

        case 'Cast':
          return this.transformCast(node);

        case 'ErrorCreation': {
          // Ruby raises with raise Exception.new(message)
          const exceptionType = node.errorType === 'TypeError' ? 'TypeError' :
                                node.errorType === 'RangeError' ? 'RangeError' :
                                'StandardError';
          return new RubyMethodCall(new RubyIdentifier(exceptionType), 'new',
            [node.message ? this.transformExpression(node.message) : RubyLiteral.String('')]);
        }

        case 'ArrayIndexOf':
          return new RubyMethodCall(
            this.transformExpression(node.array),
            'index',
            [this.transformExpression(node.element)]
          );

        case 'ArrayIncludes':
          return new RubyMethodCall(
            this.transformExpression(node.array),
            'include?',
            [this.transformExpression(node.element)]
          );

        case 'ArrayConcat':
          return new RubyBinaryExpression(
            this.transformExpression(node.left),
            '+',
            this.transformExpression(node.right)
          );

        case 'ArrayJoin':
          return new RubyMethodCall(
            this.transformExpression(node.array),
            'join',
            node.separator ? [this.transformExpression(node.separator)] : []
          );

        case 'ArrayReverse':
          return new RubyMethodCall(
            this.transformExpression(node.array),
            'reverse',
            []
          );

        case 'ArrayPop':
          return new RubyMethodCall(
            this.transformExpression(node.array),
            'pop',
            []
          );

        case 'ArrayShift':
          return new RubyMethodCall(
            this.transformExpression(node.array),
            'shift',
            []
          );

        case 'StringToBytes': {
          // Ruby: string.bytes
          const value = node.arguments?.[0] ? this.transformExpression(node.arguments[0]) : this.transformExpression(node.value);
          return new RubyMethodCall(value, 'bytes', []);
        }

        case 'BytesToString': {
          // Ruby: bytes.pack('C*')
          const value = node.arguments?.[0] ? this.transformExpression(node.arguments[0]) : this.transformExpression(node.value);
          return new RubyMethodCall(value, 'pack', [RubyLiteral.String('C*')]);
        }

        case 'Super':
          return new RubyIdentifier('super');

        case 'ConditionalExpression':
          return this.transformConditionalExpression(node);

        case 'ArrowFunctionExpression':
        case 'FunctionExpression':
          return this.transformFunctionExpression(node);

        case 'SequenceExpression':
          return this.transformExpression(node.expressions[node.expressions.length - 1]);

        case 'SpreadElement':
          return this.transformSpreadElement(node);

        case 'TemplateLiteral':
          return this.transformTemplateLiteral(node);

        case 'ObjectPattern':
          // Object destructuring - Ruby doesn't support this directly
          // Return a comment placeholder
          return new RubyIdentifier('# Object destructuring not supported in Ruby');

        case 'StaticBlock':
          return this.transformStaticBlock(node);

        case 'ChainExpression':
          // Optional chaining a?.b - Ruby has &. (safe navigation)
          return this.transformExpression(node.expression);

        case 'ClassExpression':
          // Anonymous class expression - Ruby has Class.new
          return this.transformClassExpression(node);

        case 'YieldExpression':
          // yield - Ruby has yield for blocks
          return this.transformYieldExpression(node);

        case 'PrivateIdentifier':
          // #field -> Ruby instance variable with @ prefix
          return new RubyIdentifier('@' + this.toSnakeCase(node.name));

        // IL AST StringInterpolation - `Hello ${name}` -> "Hello #{name}"
        case 'StringInterpolation': {
          let result = '';
          if (node.parts) {
            for (const part of node.parts) {
              if (part.type === 'StringPart' || part.ilNodeType === 'StringPart') {
                result += (part.value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/#\{/g, '\\#{');
              } else if (part.type === 'ExpressionPart' || part.ilNodeType === 'ExpressionPart') {
                const expr = this.transformExpression(part.expression);
                result += '#{' + (expr ? this._nodeToCode(expr) : '?') + '}';
              }
            }
          }
          return new RubyRawCode(`"${result}"`);
        }

        // IL AST ObjectLiteral - {key: value} -> {'key' => value}
        case 'ObjectLiteral': {
          if (!node.properties || node.properties.length === 0)
            return new RubyHashLiteral([]);
          const pairs = [];
          for (const prop of (node.properties || [])) {
            if (prop.type === 'SpreadElement') continue;
            const keyName = prop.key?.name || prop.key?.value || prop.key || 'key';
            const value = this.transformExpression(prop.value);
            pairs.push({ key: RubyLiteral.String(keyName), value });
          }
          return new RubyHashLiteral(pairs);
        }

        // IL AST StringFromCharCodes - String.fromCharCode(65) -> [code].pack('U*')
        case 'StringFromCharCodes': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          if (args.length === 0)
            return RubyLiteral.String('');
          if (args.length === 1)
            return new RubyMethodCall(args[0], 'chr', []);
          // Multiple chars: [codes].pack('U*')
          return new RubyMethodCall(new RubyArrayLiteral(args), 'pack', [RubyLiteral.String('U*')]);
        }

        // IL AST IsArrayCheck - Array.isArray(x) -> x.is_a?(Array)
        case 'IsArrayCheck': {
          const value = this.transformExpression(node.value);
          return new RubyMethodCall(value, 'is_a?', [new RubyIdentifier('Array')]);
        }

        // IL AST ArrowFunction - (x) => expr -> ->(x) { expr }
        case 'ArrowFunction': {
          const params = (node.params || []).map(p => {
            const name = typeof p === 'string' ? p : (p.name || 'arg');
            return new RubyIdentifier(name);
          });
          let body;
          if (node.body) {
            if (node.body.type === 'BlockStatement') {
              body = this.transformBlockStatement(node.body);
            } else {
              body = this.transformExpression(node.body);
            }
          } else {
            body = RubyLiteral.Nil();
          }
          return new RubyLambda(params, body);
        }

        // IL AST TypeOfExpression - typeof x -> x.class.name
        case 'TypeOfExpression': {
          const value = this.transformExpression(node.value);
          return new RubyMethodCall(new RubyMethodCall(value, 'class', []), 'name', []);
        }

        // IL AST Power - x ** y -> x ** y
        case 'Power': {
          const left = this.transformExpression(node.left);
          const right = this.transformExpression(node.right);
          return new RubyBinaryExpression(left, '**', right);
        }

        // IL AST ObjectFreeze - Object.freeze(x) -> x.freeze
        case 'ObjectFreeze': {
          const value = this.transformExpression(node.value);
          return new RubyMethodCall(value, 'freeze', []);
        }

        // IL AST ArrayFrom - Array.from(x) -> x.to_a or Array(x)
        case 'ArrayFrom': {
          const iterable = this.transformExpression(node.iterable);
          if (node.mapFunction) {
            // Array.from(arr, fn) -> arr.map { |x| fn.call(x) }
            const mapFn = this.transformExpression(node.mapFunction);
            return new RubyMethodCall(iterable, 'map', [], new RubyBlockExpression(
              [new RubyParameter('x')],
              [new RubyMethodCall(mapFn, 'call', [new RubyIdentifier('x')])]
            ));
          }
          return new RubyMethodCall(iterable, 'to_a', []);
        }

        // IL AST DataViewWrite - view.setUint32(offset, value, le) -> view[offset...] = [value].pack()
        case 'DataViewWrite': {
          const view = this.transformExpression(node.view);
          const offset = this.transformExpression(node.offset);
          const value = this.transformExpression(node.value);
          const method = node.method;
          const littleEndian = node.littleEndian !== false;

          // Ruby pack format
          let fmt = method.includes('32') ? (littleEndian ? 'V' : 'N') :
                    method.includes('16') ? (littleEndian ? 'v' : 'n') : 'C';
          const size = method.includes('32') ? 4 : method.includes('16') ? 2 : 1;

          return new RubyRawCode(`${view}[${offset}, ${size}] = [${value}].pack('${fmt}').bytes`);
        }

        // IL AST DataViewRead - view.getUint32(offset, le) -> view[offset...].pack().unpack()
        case 'DataViewRead': {
          const view = this.transformExpression(node.view);
          const offset = this.transformExpression(node.offset);
          const method = node.method;
          const littleEndian = node.littleEndian !== false;

          if (method === 'getUint8')
            return new RubyIndex(view, offset);

          // Ruby unpack format
          let fmt = method.includes('32') ? (littleEndian ? 'V' : 'N') :
                    method.includes('16') ? (littleEndian ? 'v' : 'n') : 'C';
          const size = method.includes('32') ? 4 : method.includes('16') ? 2 : 1;

          return new RubyRawCode(`${view}[${offset}, ${size}].pack('C*').unpack1('${fmt}')`);
        }

        // IL AST StringCharCodeAt - str.charCodeAt(i) -> str[i].ord
        case 'StringCharCodeAt': {
          const str = this.transformExpression(node.string);
          const index = this.transformExpression(node.index);
          return new RubyMethodCall(new RubyIndex(str, index), 'ord', []);
        }

        // IL AST StringReplace - str.replace(search, replace) -> str.gsub(search, replace)
        case 'StringReplace': {
          const str = this.transformExpression(node.string);
          const search = this.transformExpression(node.searchValue);
          const replace = this.transformExpression(node.replaceValue);
          return new RubyMethodCall(str, 'gsub', [search, replace]);
        }

        // IL AST BufferCreation - new ArrayBuffer(n) -> Array.new(n, 0)
        case 'BufferCreation': {
          const size = this.transformExpression(node.size);
          return new RubyMethodCall(new RubyConstantAccess('Array'), 'new', [size, RubyLiteral.Integer(0)]);
        }

        // IL AST MathCall - Math.imul(a,b) or other Math methods
        case 'MathCall': {
          const method = node.method;
          const args = (node.arguments || []).map(a => this.transformExpression(a));

          if (method === 'imul') {
            // Math.imul(a, b) -> ((a * b) & 0xFFFFFFFF).then convert to signed
            if (args.length >= 2)
              return new RubyRawCode(`[${args[0]} * ${args[1]}].pack('l').unpack1('l')`);
          }
          // Default: use Math module
          const rubyMethod = method.toLowerCase();
          if (rubyMethod === 'floor' || rubyMethod === 'ceil' || rubyMethod === 'abs' || rubyMethod === 'sqrt')
            return new RubyMethodCall(args[0], rubyMethod, args.length > 1 ? args.slice(1) : []);
          return new RubyMethodCall(new RubyConstantAccess('Math'), rubyMethod, args);
        }

        // IL AST TypedArraySubarray - arr.subarray(start, end) -> arr[start...end]
        case 'TypedArraySubarray': {
          const array = this.transformExpression(node.array);
          const start = this.transformExpression(node.start);
          const end = node.end ? this.transformExpression(node.end) : null;

          if (end)
            return new RubyIndex(array, new RubyRange(start, end, true));
          return new RubyRawCode(`${array}[${start}..]`);
        }

        // ========================[ Array Higher-Order Operations ]========================

        // IL AST ArrayEvery - arr.every(fn) -> arr.all? { |e| ... }
        case 'ArrayEvery': {
          const array = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : null;
          if (callback)
            return new RubyMethodCall(array, 'all?', [], new RubyBlockExpression(
              [new RubyParameter('e')],
              this.wrapInBlock(new RubyExpressionStatement(new RubyMethodCall(callback, 'call', [new RubyIdentifier('e')])))
            ));
          return new RubyMethodCall(array, 'all?', []);
        }

        // IL AST ArrayFilter - arr.filter(fn) -> arr.select { |e| ... }
        case 'ArrayFilter': {
          const array = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : null;
          if (callback)
            return new RubyMethodCall(array, 'select', [], new RubyBlockExpression(
              [new RubyParameter('e')],
              this.wrapInBlock(new RubyExpressionStatement(new RubyMethodCall(callback, 'call', [new RubyIdentifier('e')])))
            ));
          return new RubyMethodCall(array, 'select', []);
        }

        // IL AST ArrayFind - arr.find(fn) -> arr.detect { |e| ... }
        case 'ArrayFind': {
          const array = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : null;
          if (callback)
            return new RubyMethodCall(array, 'detect', [], new RubyBlockExpression(
              [new RubyParameter('e')],
              this.wrapInBlock(new RubyExpressionStatement(new RubyMethodCall(callback, 'call', [new RubyIdentifier('e')])))
            ));
          return new RubyMethodCall(array, 'detect', []);
        }

        // IL AST ArrayFindIndex - arr.findIndex(fn) -> arr.index { |e| ... }
        case 'ArrayFindIndex': {
          const array = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : null;
          if (callback)
            return new RubyMethodCall(array, 'index', [], new RubyBlockExpression(
              [new RubyParameter('e')],
              this.wrapInBlock(new RubyExpressionStatement(new RubyMethodCall(callback, 'call', [new RubyIdentifier('e')])))
            ));
          return new RubyMethodCall(array, 'index', []);
        }

        // IL AST ArrayForEach - arr.forEach(fn) -> arr.each { |e| ... }
        case 'ArrayForEach': {
          const array = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : null;
          if (callback)
            return new RubyMethodCall(array, 'each', [], new RubyBlockExpression(
              [new RubyParameter('e')],
              this.wrapInBlock(new RubyExpressionStatement(new RubyMethodCall(callback, 'call', [new RubyIdentifier('e')])))
            ));
          return new RubyMethodCall(array, 'each', []);
        }

        // IL AST ArrayMap - arr.map(fn) -> arr.map { |e| ... }
        case 'ArrayMap': {
          const array = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : null;
          if (callback)
            return new RubyMethodCall(array, 'map', [], new RubyBlockExpression(
              [new RubyParameter('e')],
              this.wrapInBlock(new RubyExpressionStatement(new RubyMethodCall(callback, 'call', [new RubyIdentifier('e')])))
            ));
          return new RubyMethodCall(array, 'map', []);
        }

        // IL AST ArrayReduce - arr.reduce(fn, init) -> arr.inject(init) { |acc, e| ... }
        case 'ArrayReduce': {
          const array = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : null;
          const initArgs = node.initialValue ? [this.transformExpression(node.initialValue)] : [];
          if (callback)
            return new RubyMethodCall(array, 'inject', initArgs, new RubyBlockExpression(
              [new RubyParameter('acc'), new RubyParameter('e')],
              this.wrapInBlock(new RubyExpressionStatement(new RubyMethodCall(callback, 'call', [new RubyIdentifier('acc'), new RubyIdentifier('e')])))
            ));
          return new RubyMethodCall(array, 'inject', initArgs);
        }

        // IL AST ArraySome - arr.some(fn) -> arr.any? { |e| ... }
        case 'ArraySome': {
          const array = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : null;
          if (callback)
            return new RubyMethodCall(array, 'any?', [], new RubyBlockExpression(
              [new RubyParameter('e')],
              this.wrapInBlock(new RubyExpressionStatement(new RubyMethodCall(callback, 'call', [new RubyIdentifier('e')])))
            ));
          return new RubyMethodCall(array, 'any?', []);
        }

        // IL AST ArraySort - arr.sort(fn?) -> arr.sort or arr.sort { |a, b| ... }
        case 'ArraySort': {
          const array = this.transformExpression(node.array);
          if (node.compareFn) {
            const compareFn = this.transformExpression(node.compareFn);
            return new RubyMethodCall(array, 'sort', [], new RubyBlockExpression(
              [new RubyParameter('a'), new RubyParameter('b')],
              this.wrapInBlock(new RubyExpressionStatement(new RubyMethodCall(compareFn, 'call', [new RubyIdentifier('a'), new RubyIdentifier('b')])))
            ));
          }
          return new RubyMethodCall(array, 'sort', []);
        }

        // IL AST ArraySplice - arr.splice(start, deleteCount, ...items) -> arr.slice!(start, count) + arr.insert(start, *items)
        case 'ArraySplice': {
          const array = this.transformExpression(node.array);
          const args = [];
          if (node.start !== undefined) args.push(this.transformExpression(node.start));
          if (node.deleteCount !== undefined) args.push(this.transformExpression(node.deleteCount));
          if (node.items && node.items.length > 0) {
            const items = node.items.map(item => this.transformExpression(item));
            // arr[start, deleteCount] = [items]
            const start = args[0] || RubyLiteral.Integer(0);
            const count = args[1] || RubyLiteral.Integer(0);
            return new RubyRawCode(`${array}[${start}, ${count}] = [${items.join(', ')}]`);
          }
          // No items to insert - just delete: arr.slice!(start, count)
          return new RubyMethodCall(array, 'slice!', args);
        }

        // IL AST ArrayUnshift - arr.unshift(value) -> arr.unshift(value)
        case 'ArrayUnshift': {
          const array = this.transformExpression(node.array);
          const value = node.value ? this.transformExpression(node.value) : null;
          return new RubyMethodCall(array, 'unshift', value ? [value] : []);
        }

        // ========================[ String Operations ]========================

        // IL AST StringCharAt - str.charAt(index) -> str[index]
        case 'StringCharAt': {
          const str = this.transformExpression(node.string || node.value);
          const index = this.transformExpression(node.index);
          return new RubyIndex(str, index);
        }

        // IL AST StringEndsWith - str.endsWith(suffix) -> str.end_with?(suffix)
        case 'StringEndsWith': {
          const str = this.transformExpression(node.string || node.value);
          const searchValue = this.transformExpression(node.searchValue || node.search || node.suffix);
          return new RubyMethodCall(str, 'end_with?', [searchValue]);
        }

        // IL AST StringIncludes - str.includes(sub) -> str.include?(sub)
        case 'StringIncludes': {
          const str = this.transformExpression(node.string || node.value);
          const searchValue = this.transformExpression(node.searchValue || node.search);
          return new RubyMethodCall(str, 'include?', [searchValue]);
        }

        // IL AST StringIndexOf - str.indexOf(sub) -> str.index(sub)
        case 'StringIndexOf': {
          const str = this.transformExpression(node.string || node.value);
          const search = this.transformExpression(node.search || node.searchValue);
          return new RubyMethodCall(str, 'index', search ? [search] : []);
        }

        // IL AST StringRepeat - str.repeat(count) -> str * count
        case 'StringRepeat': {
          const str = this.transformExpression(node.string || node.value);
          const count = this.transformExpression(node.count);
          return new RubyBinaryExpression(str, '*', count);
        }

        // IL AST StringSplit - str.split(delim) -> str.split(delim)
        case 'StringSplit': {
          const str = this.transformExpression(node.string || node.value);
          const separator = node.separator ? this.transformExpression(node.separator) : null;
          return new RubyMethodCall(str, 'split', separator ? [separator] : []);
        }

        // IL AST StringStartsWith - str.startsWith(prefix) -> str.start_with?(prefix)
        case 'StringStartsWith': {
          const str = this.transformExpression(node.string || node.value);
          const searchValue = this.transformExpression(node.searchValue || node.search || node.prefix);
          return new RubyMethodCall(str, 'start_with?', [searchValue]);
        }

        // IL AST StringSubstring - str.substring(start, end) -> str[start...end]
        case 'StringSubstring': {
          const str = this.transformExpression(node.string || node.value);
          const start = node.start ? this.transformExpression(node.start) : RubyLiteral.Integer(0);
          if (node.end) {
            const end = this.transformExpression(node.end);
            return new RubyIndex(str, new RubyRange(start, end, true));
          }
          return new RubyIndex(str, new RubyRange(start, RubyLiteral.Integer(-1), false));
        }

        // IL AST StringToLowerCase - str.toLowerCase() -> str.downcase
        case 'StringToLowerCase': {
          const str = this.transformExpression(node.string || node.value || node.argument);
          return new RubyMethodCall(str, 'downcase', []);
        }

        // IL AST StringToUpperCase - str.toUpperCase() -> str.upcase
        case 'StringToUpperCase': {
          const str = this.transformExpression(node.string || node.value || node.argument);
          return new RubyMethodCall(str, 'upcase', []);
        }

        // IL AST StringTrim - str.trim() -> str.strip
        case 'StringTrim': {
          const str = this.transformExpression(node.string || node.value || node.argument);
          return new RubyMethodCall(str, 'strip', []);
        }

        // IL AST StringTransform - generic string method call
        case 'StringTransform': {
          const str = this.transformExpression(node.string || node.value || node.argument);
          const method = node.method || 'to_s';
          switch (method) {
            case 'toLowerCase':
              return new RubyMethodCall(str, 'downcase', []);
            case 'toUpperCase':
              return new RubyMethodCall(str, 'upcase', []);
            case 'trim':
              return new RubyMethodCall(str, 'strip', []);
            case 'trimStart':
            case 'trimLeft':
              return new RubyMethodCall(str, 'lstrip', []);
            case 'trimEnd':
            case 'trimRight':
              return new RubyMethodCall(str, 'rstrip', []);
            case 'toString':
              return new RubyMethodCall(str, 'to_s', []);
            default: {
              const args = (node.arguments || []).map(a => this.transformExpression(a));
              return new RubyMethodCall(str, this.toSnakeCase(method), args);
            }
          }
        }

        // IL AST StringConcat - str1 + str2 -> str1 + str2
        case 'StringConcat': {
          const str = this.transformExpression(node.string || node.value);
          const concatArgs = (node.args || node.strings || []).map(a => this.transformExpression(a));
          if (concatArgs.length === 0) return str;
          let result = str;
          for (const arg of concatArgs) {
            result = new RubyBinaryExpression(result, '+', arg);
          }
          return result;
        }

        // ========================[ Buffer/DataView Operations ]========================

        // IL AST DataViewCreation - new DataView(buffer) -> buffer (Ruby arrays work as views)
        case 'DataViewCreation': {
          if (node.buffer) return this.transformExpression(node.buffer);
          return new RubyArrayLiteral([]);
        }

        // ========================[ Map/Set Operations ]========================

        // IL AST MapCreation - new Map() -> {} (Ruby Hash)
        case 'MapCreation': {
          if (node.entries) {
            const entries = this.transformExpression(node.entries);
            // Convert entries to Hash: entries.to_h
            return new RubyMethodCall(entries, 'to_h', []);
          }
          return new RubyHashLiteral([]);
        }

        // IL AST MapGet - map.get(key) -> hash[key]
        case 'MapGet': {
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          return new RubyIndex(map, key);
        }

        // IL AST MapSet - map.set(key, value) -> hash[key] = value
        case 'MapSet': {
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          const value = this.transformExpression(node.value);
          return new RubyAssignment(new RubyIndex(map, key), value);
        }

        // IL AST MapHas - map.has(key) -> hash.key?(key)
        case 'MapHas': {
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          return new RubyMethodCall(map, 'key?', [key]);
        }

        // IL AST MapDelete - map.delete(key) -> hash.delete(key)
        case 'MapDelete': {
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          return new RubyMethodCall(map, 'delete', [key]);
        }

        // IL AST SetCreation - new Set() -> require 'set'; Set.new
        case 'SetCreation': {
          this.requires.add('set');
          const args = node.values ? [this.transformExpression(node.values)] : [];
          return new RubyMethodCall(new RubyIdentifier('Set'), 'new', args);
        }

        // ========================[ Missing Utility Operations ]========================

        // IL AST CopyArray - array.slice() -> arr.dup
        case 'CopyArray': {
          const array = this.transformExpression(node.array || node.arguments?.[0] || node.value);
          return new RubyMethodCall(array, 'dup', []);
        }

        // IL AST TypedArraySet - typedArray.set(source, offset) -> manual array copy
        case 'TypedArraySet': {
          const target = this.transformExpression(node.array || node.target);
          const source = node.source ? this.transformExpression(node.source) : null;
          const offset = node.offset ? this.transformExpression(node.offset) : RubyLiteral.Integer(0);
          if (source)
            return new RubyRawCode(`${target}[${offset}, ${source}.length] = ${source}`);
          return target;
        }

        // IL AST ObjectKeys - Object.keys(obj) -> hash.keys
        case 'ObjectKeys': {
          const obj = this.transformExpression(node.object || node.value);
          return new RubyMethodCall(obj, 'keys', []);
        }

        // IL AST ObjectValues - Object.values(obj) -> hash.values
        case 'ObjectValues': {
          const obj = this.transformExpression(node.object || node.value);
          return new RubyMethodCall(obj, 'values', []);
        }

        // IL AST ObjectEntries - Object.entries(obj) -> hash.to_a
        case 'ObjectEntries': {
          const obj = this.transformExpression(node.object || node.value);
          return new RubyMethodCall(obj, 'to_a', []);
        }

        // IL AST ObjectCreate - Object.create(proto) -> {}
        case 'ObjectCreate': {
          if (node.prototype) {
            const proto = this.transformExpression(node.prototype);
            return new RubyMethodCall(proto, 'dup', []);
          }
          return new RubyHashLiteral([]);
        }

        // IL AST Random - Math.random() -> rand
        case 'Random':
          return new RubyMethodCall(null, 'rand', []);

        // IL AST DebugOutput - console.log(...) -> $stderr.puts(...)
        case 'DebugOutput': {
          const args = (node.arguments || []).map(arg => this.transformExpression(arg));
          const method = node.method || node.level || 'log';
          if (method === 'warn' || method === 'error')
            return new RubyMethodCall(new RubyIdentifier('$stderr'), 'puts', args);
          return new RubyMethodCall(null, 'puts', args);
        }

        // IL AST IsFiniteCheck - Number.isFinite(x) -> x.finite?
        case 'IsFiniteCheck': {
          const value = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
          return new RubyMethodCall(value, 'finite?', []);
        }

        // IL AST IsNaNCheck - Number.isNaN(x) -> x.nan?
        case 'IsNaNCheck': {
          const value = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
          return new RubyMethodCall(new RubyMethodCall(value, 'to_f', []), 'nan?', []);
        }

        // IL AST IsIntegerCheck - Number.isInteger(x) -> x.is_a?(Integer)
        case 'IsIntegerCheck': {
          const value = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
          return new RubyMethodCall(value, 'is_a?', [new RubyIdentifier('Integer')]);
        }

        default:
          return null;
      }
    }

    /**
     * Transform an identifier
     */
    transformIdentifier(node) {
      let name = node.name;

      // Map JavaScript keywords
      if (name === 'undefined') return RubyLiteral.Nil();
      if (name === 'null') return RubyLiteral.Nil();

      return new RubyIdentifier(this.toSnakeCase(name));
    }

    /**
     * Transform a literal
     */
    transformLiteral(node) {
      if (typeof node.value === 'number') {
        if (Number.isInteger(node.value)) {
          return RubyLiteral.Integer(node.value);
        }
        return RubyLiteral.Float(node.value);
      }

      // Handle BigInt values - Ruby supports big integers natively
      if (typeof node.value === 'bigint') {
        // Convert BigInt to string and create integer literal
        return RubyLiteral.Integer(node.value.toString());
      }

      if (typeof node.value === 'string') {
        return RubyLiteral.String(node.value);
      }

      if (typeof node.value === 'boolean') {
        return node.value ? RubyLiteral.True() : RubyLiteral.False();
      }

      if (node.value === null) {
        return RubyLiteral.Nil();
      }
      // Handle undefined - treat same as nil in Ruby
      if (node.value === undefined) {
        return RubyLiteral.Nil();
      }

      return RubyLiteral.Nil();
    }

    /**
     * Transform a binary expression
     */
    transformBinaryExpression(node) {
      const left = this.transformExpression(node.left);
      const right = this.transformExpression(node.right);

      let operator = node.operator;
      if (operator === '===') operator = '==';
      if (operator === '!==') operator = '!=';
      if (operator === '>>>') operator = '>>';

      return new RubyBinaryExpression(left, operator, right);
    }

    /**
     * Transform a unary expression
     */
    transformUnaryExpression(node) {
      const operand = this.transformExpression(node.argument);
      return new RubyUnaryExpression(node.operator, operand);
    }

    /**
     * Transform an assignment expression
     */
    transformAssignmentExpression(node) {
      const left = this.transformExpression(node.left);
      const right = this.transformExpression(node.right);

      const assignment = new RubyAssignment(left, right);
      assignment.operator = node.operator;
      return assignment;
    }

    /**
     * Transform an update expression (++, --)
     */
    transformUpdateExpression(node) {
      const operand = this.transformExpression(node.argument);

      const op = node.operator === '++' ? '+=' : '-=';
      const assignment = new RubyAssignment(operand, RubyLiteral.Integer(1));
      assignment.operator = op;
      return assignment;
    }

    /**
     * Transform a member expression
     */
    transformMemberExpression(node) {
      // Known enum objects
      const ENUM_OBJECTS = new Set([
        'CategoryType', 'SecurityStatus', 'ComplexityType', 'CountryCode'
      ]);

      // Helper classes and types
      const FRAMEWORK_TYPES = new Set([
        'KeySize', 'LinkItem', 'Vulnerability', 'TestCase', 'AuthResult'
      ]);

      // Handle AlgorithmFramework access
      if (node.object.type === 'Identifier' && node.object.name === 'AlgorithmFramework') {
        const propName = this.getPropertyName(node.property);

        // Track AlgorithmFramework usage
        this.frameworkFunctions.add('algorithm_framework');

        // For enums like AlgorithmFramework.CategoryType
        if (ENUM_OBJECTS.has(propName)) {
          this.enumsUsed.add(this.toSnakeCase(propName));
          return new RubyIdentifier(this.toSnakeCase(propName));
        }

        // For helper classes like AlgorithmFramework.KeySize
        if (FRAMEWORK_TYPES.has(propName)) {
          this.helperClasses.add(propName);
          return new RubyIdentifier(propName);
        }

        // Default: return snake_case property
        return new RubyIdentifier(this.toSnakeCase(propName));
      }

      // Handle nested MemberExpression like AlgorithmFramework.CategoryType.BLOCK
      if (node.object.type === 'MemberExpression' &&
          node.object.object.type === 'Identifier' &&
          node.object.object.name === 'AlgorithmFramework') {
        const middleProp = this.getPropertyName(node.object.property);
        const outerProp = this.getPropertyName(node.property);

        // Track AlgorithmFramework usage
        this.frameworkFunctions.add('algorithm_framework');

        // For enum constants like AlgorithmFramework.CategoryType.BLOCK
        if (ENUM_OBJECTS.has(middleProp)) {
          this.enumsUsed.add(this.toSnakeCase(middleProp));
          // Return enum_object.CONSTANT (keep constant uppercase)
          return new RubyMethodCall(
            new RubyIdentifier(this.toSnakeCase(middleProp)),
            outerProp,  // Keep enum constant in original case
            []
          );
        }
      }

      // Check if accessing enum constant (keep UPPERCASE)
      const isEnumAccess = node.object.type === 'Identifier' && ENUM_OBJECTS.has(node.object.name);
      if (isEnumAccess)
        this.enumsUsed.add(this.toSnakeCase(node.object.name));

      const object = this.transformExpression(node.object);

      if (node.computed) {
        const index = this.transformExpression(node.property);
        return new RubyIndex(object, index);
      } else {
        const methodName = this.getPropertyName(node.property);

        // Handle special properties
        if (methodName === 'length') {
          return new RubyMethodCall(object, 'length', []);
        }

        // Instance variable access for this.x
        if (node.object.type === 'ThisExpression') {
          let fieldName = this.toSnakeCase(methodName);
          if (fieldName.startsWith('_')) fieldName = fieldName.substring(1);
          const identifier = new RubyIdentifier(fieldName);
          identifier.isInstance = true;
          return identifier;
        }

        // Method call with no arguments
        return new RubyMethodCall(object, this.toSnakeCase(methodName), []);
      }
    }

    /**
     * Transform a call expression
     */
    transformCallExpression(node) {
      // Track framework function calls
      if (node.callee.type === 'Identifier') {
        if (node.callee.name === 'RegisterAlgorithm' || node.callee.name === 'register_algorithm')
          this.frameworkFunctions.add('register_algorithm');
      }

      // Handle BigInt constructor - Ruby has native big integer support
      if (node.callee.type === 'Identifier' && node.callee.name === 'BigInt') {
        if (node.arguments.length > 0) {
          const arg = node.arguments[0];
          // BigInt('0x...') or BigInt(number) - Ruby handles big integers natively
          if (arg.type === 'Literal' || arg.type === 'StringLiteral') {
            const val = arg.value;
            if (typeof val === 'string') {
              // Parse hex string to integer
              try {
                const num = BigInt(val);
                // Output as hex for readability
                return RubyLiteral.Integer(num.toString().replace(/n$/, ''));
              } catch (e) {
                return RubyLiteral.Integer(0);
              }
            } else if (typeof val === 'number') {
              return RubyLiteral.Integer(val);
            }
          }
          // Otherwise just convert the argument
          return new RubyMethodCall(this.transformExpression(arg), 'to_i', []);
        }
        return RubyLiteral.Integer(0);
      }

      // Handle OpCodes calls
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'OpCodes') {
        return this.transformOpCodesCall(node);
      }

      // Handle method calls
      if (node.callee.type === 'MemberExpression') {
        const object = this.transformExpression(node.callee.object);
        const method = this.getPropertyName(node.callee.property);
        const methodName = this.toSnakeCase(method);
        const args = node.arguments.map(arg => this.transformExpression(arg));

        return new RubyMethodCall(object, methodName, args);
      }

      // Regular function call
      const callee = this.transformExpression(node.callee);
      const args = node.arguments.map(arg => this.transformExpression(arg));

      // In Ruby, function calls are method calls
      return new RubyMethodCall(null, callee.name || 'call', args);
    }

    /**
     * Transform OpCodes calls to Ruby equivalents
     */
    transformOpCodesCall(node) {
      const methodName = node.callee.property.name;
      const args = node.arguments.map(arg => this.transformExpression(arg));

      // Map OpCodes methods to Ruby
      switch (methodName) {
        case 'RotL32':
        case 'RotR32':
        case 'RotL8':
        case 'RotR8':
          // Ruby bitwise rotation
          const direction = methodName.includes('RotL') ? '<<' : '>>';
          const bits = methodName.includes('8') ? 8 : 32;
          const oppDirection = methodName.includes('RotL') ? '>>' : '<<';
          return new RubyBinaryExpression(
            new RubyBinaryExpression(args[0], direction, args[1]),
            '|',
            new RubyBinaryExpression(args[0], oppDirection, new RubyBinaryExpression(RubyLiteral.Integer(bits), '-', args[1]))
          );

        case 'Pack32LE':
        case 'Pack32BE':
        case 'Pack16LE':
        case 'Pack16BE':
          // Ruby pack
          const format = methodName.includes('LE') ? 'V' : 'N';
          return new RubyMethodCall(new RubyArrayLiteral(args), 'pack', [RubyLiteral.String(format)]);

        case 'Unpack32LE':
        case 'Unpack32BE':
        case 'Unpack16LE':
        case 'Unpack16BE':
          const unpackFormat = methodName.includes('LE') ? 'V' : 'N';
          return new RubyMethodCall(args[0], 'unpack', [RubyLiteral.String(unpackFormat)]);

        case 'XorArrays':
          return new RubyMethodCall(
            new RubyMethodCall(args[0], 'zip', [args[1]]),
            'map',
            [],
            new RubyBlockExpression(
              [new RubyParameter('a'), new RubyParameter('b')],
              this.wrapInBlock(new RubyExpressionStatement(
                new RubyBinaryExpression(new RubyIdentifier('a'), '^', new RubyIdentifier('b'))
              ))
            )
          );

        case 'ClearArray':
          return new RubyMethodCall(args[0], 'fill', [RubyLiteral.Integer(0)]);

        case 'Hex8ToBytes':
          return new RubyMethodCall(
            new RubyMethodCall(new RubyArrayLiteral([args[0]]), 'pack', [RubyLiteral.String('H*')]),
            'bytes',
            []
          );

        case 'BytesToHex8':
          return new RubyMethodCall(
            new RubyMethodCall(args[0], 'pack', [RubyLiteral.String('C*')]),
            'unpack1',
            [RubyLiteral.String('H*')]
          );

        case 'AnsiToBytes':
          return new RubyMethodCall(args[0], 'bytes', []);

        // 64-bit BigInt operations (Ruby handles big integers natively)
        case 'AndN':
          return new RubyBinaryExpression(args[0], '&', args[1]);
        case 'OrN':
          return new RubyBinaryExpression(args[0], '|', args[1]);
        case 'XorN':
          return new RubyBinaryExpression(args[0], '^', args[1]);
        case 'ShiftLn':
          return new RubyBinaryExpression(args[0], '<<', args[1]);
        case 'ShiftRn':
          return new RubyBinaryExpression(args[0], '>>', args[1]);
        case 'AddN':
          return new RubyBinaryExpression(args[0], '+', args[1]);
        case 'SubN':
          return new RubyBinaryExpression(args[0], '-', args[1]);
        case 'MulN':
          return new RubyBinaryExpression(args[0], '*', args[1]);
        case 'DivN':
          return new RubyBinaryExpression(args[0], '/', args[1]);
        case 'ModN':
          return new RubyBinaryExpression(args[0], '%', args[1]);
        case 'NotN':
          return new RubyUnaryExpression('~', args[0]);

        default:
          return new RubyMethodCall(null, this.toSnakeCase(methodName), args);
      }
    }

    /**
     * Transform an array expression
     */
    transformArrayExpression(node) {
      const elements = node.elements.map(elem => this.transformExpression(elem));
      return new RubyArrayLiteral(elements);
    }

    /**
     * Transform an object expression to hash literal
     */
    transformObjectExpression(node) {
      const pairs = [];
      for (const prop of node.properties) {
        if (!prop.key) continue;

        const value = this.transformExpression(prop.value);
        let keyExpr;

        // Check if key is numeric (actual number or numeric string)
        const keyValue = prop.key.value;
        const isNumericKey = typeof keyValue === 'number' ||
          (typeof keyValue === 'string' && /^\d+$/.test(keyValue)) ||
          prop.key.type === 'NumericLiteral';

        if (isNumericKey) {
          // Numeric keys use => syntax in Ruby
          keyExpr = RubyLiteral.Integer(parseInt(keyValue, 10));
        } else {
          const key = prop.key.name || prop.key.value || 'unknown';
          // Use symbols for string/identifier keys
          keyExpr = this.options.useSymbolKeys !== false
            ? RubyLiteral.Symbol(this.toSnakeCase(String(key)))
            : RubyLiteral.String(String(key));
        }

        pairs.push({ key: keyExpr, value });
      }

      return new RubyHashLiteral(pairs);
    }

    /**
     * Transform a new expression
     */
    transformNewExpression(node) {
      // Helper classes to track for stub generation
      const HELPER_CLASSES = new Set([
        'KeySize', 'LinkItem', 'Vulnerability', 'TestCase', 'AuthResult'
      ]);

      if (node.callee.type === 'Identifier') {
        const typeName = node.callee.name;

        // Track helper class usage for stub generation
        if (HELPER_CLASSES.has(typeName))
          this.helperClasses.add(typeName);

        // TypedArrays
        const typedArrayMap = {
          'Uint8Array': 'Array',
          'Uint16Array': 'Array',
          'Uint32Array': 'Array',
          'Int8Array': 'Array',
          'Int16Array': 'Array',
          'Int32Array': 'Array',
          'Array': 'Array'
        };

        if (typedArrayMap[typeName]) {
          if (node.arguments.length > 0) {
            const size = this.transformExpression(node.arguments[0]);
            return new RubyMethodCall(new RubyIdentifier('Array'), 'new', [size]);
          }
          return new RubyArrayLiteral([]);
        }

        const className = this.toCamelCase(typeName);
        const args = node.arguments.map(arg => this.transformExpression(arg));
        return new RubyMethodCall(new RubyIdentifier(className), 'new', args);
      }

      // Handle MemberExpression like AlgorithmFramework.KeySize
      if (node.callee.type === 'MemberExpression') {
        const propName = node.callee.property.name || node.callee.property.value;
        if (propName && HELPER_CLASSES.has(propName))
          this.helperClasses.add(propName);

        const className = this.toCamelCase(propName);
        const args = node.arguments.map(arg => this.transformExpression(arg));
        return new RubyMethodCall(new RubyIdentifier(className), 'new', args);
      }

      return null;
    }

    /**
     * Transform a conditional expression (ternary)
     */
    transformConditionalExpression(node) {
      const condition = this.transformExpression(node.test);
      const thenExpr = this.transformExpression(node.consequent);
      const elseExpr = this.transformExpression(node.alternate);

      return new RubyConditional(condition, thenExpr, elseExpr);
    }

    /**
     * Transform a function expression to lambda
     */
    transformFunctionExpression(node) {
      const params = node.params ? node.params.map(p => {
        const paramName = this.toSnakeCase(p.name);
        const paramType = this.inferTypeFromName(p.name);
        return new RubyParameter(paramName, paramType);
      }) : [];

      let body = null;
      if (node.body) {
        if (node.body.type === 'BlockStatement') {
          body = this.transformBlockStatement(node.body);
        } else {
          body = this.wrapInBlock(new RubyExpressionStatement(this.transformExpression(node.body)));
        }
      }

      return new RubyLambda(params, body);
    }

    /**
     * Transform spread element
     */
    transformSpreadElement(node) {
      const splatExpr = new RubySplat(this.transformExpression(node.argument));
      return splatExpr;
    }

    /**
     * Transform template literal to string interpolation
     */
    transformTemplateLiteral(node) {
      const parts = [];

      for (let i = 0; i < node.quasis.length; ++i) {
        const text = node.quasis[i].value.raw;
        if (text) parts.push(text);

        if (i < node.expressions.length) {
          parts.push(this.transformExpression(node.expressions[i]));
        }
      }

      return new RubyStringInterpolation(parts);
    }

    // ========================[ IL AST NODE TRANSFORMERS ]========================

    /**
     * Transform ParentConstructorCall to super(...)
     */
    transformParentConstructorCall(node) {
      const args = (node.arguments || []).map(arg => this.transformExpression(arg));
      return new RubySuper(args);
    }

    /**
     * Transform ParentMethodCall to super.method_name(...) - Ruby doesn't support this directly
     * Ruby uses super with a different method name context, so we use super for same-named method
     */
    transformParentMethodCall(node) {
      const args = (node.arguments || []).map(arg => this.transformExpression(arg));
      // In Ruby, super calls the parent's same-named method
      // For different method names, we'd need a different approach
      return new RubySuper(args);
    }

    /**
     * Transform ThisMethodCall to method_name(...) - Ruby uses implicit self
     */
    transformThisMethodCall(node) {
      const args = (node.arguments || []).map(arg => this.transformExpression(arg));
      const methodName = this.toSnakeCase(node.method);
      // In Ruby, methods on self can be called without explicit receiver
      return new RubyMethodCall(null, methodName, args);
    }

    /**
     * Transform OpCodesCall IL node (generic OpCodes method call)
     */
    transformOpCodesCallIL(node) {
      const args = (node.arguments || []).map(arg => this.transformExpression(arg));
      const methodName = node.method;

      // Handle specific OpCodes methods that need special Ruby translation
      switch (methodName) {
        case 'CopyArray':
          // Ruby: array.dup
          return new RubyMethodCall(args[0], 'dup', []);
        case 'ClearArray':
          // Ruby: array.fill(0) or array.clear
          return new RubyMethodCall(args[0], 'fill', [RubyLiteral.Integer(0)]);
        case 'AnsiToBytes':
          // Ruby: string.bytes
          return new RubyMethodCall(args[0], 'bytes', []);
        case 'Hex8ToBytes':
          // Ruby: [hex_string].pack('H*').bytes
          return new RubyMethodCall(
            new RubyMethodCall(new RubyArrayLiteral([args[0]]), 'pack', [RubyLiteral.String('H*')]),
            'bytes',
            []
          );
        case 'BytesToHex8':
          // Ruby: bytes.pack('C*').unpack1('H*')
          return new RubyMethodCall(
            new RubyMethodCall(args[0], 'pack', [RubyLiteral.String('C*')]),
            'unpack1',
            [RubyLiteral.String('H*')]
          );
        default:
          // Generic fallback - call method as function with snake_case name
          return new RubyMethodCall(null, this.toSnakeCase(methodName), args);
      }
    }

    /**
     * Transform RotateLeft/RotateRight to bitwise rotation
     * Ruby: ((value << amount) | (value >> (bits - amount))) & mask
     */
    transformRotation(node) {
      const value = this.transformExpression(node.value);
      const amount = this.transformExpression(node.amount);
      const bits = node.bits || 32;
      const isLeft = node.type === 'RotateLeft';

      const mask = bits === 64 ? 0xFFFFFFFFFFFFFFFF : (bits === 32 ? 0xFFFFFFFF : (1 << bits) - 1);
      const maskLiteral = RubyLiteral.Integer(mask);

      if (isLeft) {
        // (((value << amount) | (value >> (bits - amount))) & mask)
        return new RubyBinaryExpression(
          new RubyBinaryExpression(
            new RubyBinaryExpression(value, '<<', amount),
            '|',
            new RubyBinaryExpression(value, '>>', new RubyBinaryExpression(RubyLiteral.Integer(bits), '-', amount))
          ),
          '&',
          maskLiteral
        );
      } else {
        // (((value >> amount) | (value << (bits - amount))) & mask)
        return new RubyBinaryExpression(
          new RubyBinaryExpression(
            new RubyBinaryExpression(value, '>>', amount),
            '|',
            new RubyBinaryExpression(value, '<<', new RubyBinaryExpression(RubyLiteral.Integer(bits), '-', amount))
          ),
          '&',
          maskLiteral
        );
      }
    }

    /**
     * Transform PackBytes IL node
     * Ruby: bytes → integer: [b0, b1, b2, b3].pack("C*").unpack1("N")
     */
    transformPackBytes(node) {
      // IL PackBytes nodes have arguments array, not bytes property
      const args = node.arguments || node.bytes || [];
      const bytes = args.map(arg => {
        if (arg.type === 'SpreadElement') {
          return this.transformExpression(arg.argument);
        }
        return this.transformExpression(arg);
      });
      const bits = node.bits || 32;
      const isBE = node.endian === 'big' || node.bigEndian;

      // Pack format for unpack1: N=32BE, V=32LE, n=16BE, v=16LE
      let format;
      if (bits === 32) format = isBE ? 'N' : 'V';
      else if (bits === 16) format = isBE ? 'n' : 'v';
      else format = 'C';

      // Pack bytes as C* then unpack as integer
      // [b0, b1, b2, b3].pack("C*").unpack1("N") -> integer
      let byteArray;
      if (bytes.length === 1 && args[0]?.type === 'SpreadElement') {
        byteArray = bytes[0]; // Already a byte array
      } else {
        byteArray = new RubyArrayLiteral(bytes);
      }
      const packedString = new RubyMethodCall(byteArray, 'pack', [RubyLiteral.String('C*')]);
      return new RubyMethodCall(packedString, 'unpack1', [RubyLiteral.String(format)]);
    }

    /**
     * Transform UnpackBytes IL node
     * Ruby: integer → bytes: [value].pack("N").bytes
     */
    transformUnpackBytes(node) {
      // IL UnpackBytes nodes have arguments array, not value property
      const value = this.transformExpression(node.arguments?.[0] || node.value);
      const bits = node.bits || 32;
      const isBE = node.endian === 'big' || node.bigEndian;

      // Pack format: N=32BE, V=32LE, n=16BE, v=16LE
      let format;
      if (bits === 32) format = isBE ? 'N' : 'V';
      else if (bits === 16) format = isBE ? 'n' : 'v';
      else format = 'C';

      // [value].pack("N").bytes -> byte array
      const intArray = new RubyArrayLiteral([value]);
      const packedString = new RubyMethodCall(intArray, 'pack', [RubyLiteral.String(format)]);
      return new RubyMethodCall(packedString, 'bytes', []);
    }

    /**
     * Transform ArrayLength IL node
     * Ruby: array.length
     */
    transformArrayLength(node) {
      const array = this.transformExpression(node.array);
      return new RubyMethodCall(array, 'length', []);
    }

    /**
     * Transform ArrayAppend IL node
     * Ruby: array.push(element) or array << element
     */
    transformArrayAppend(node) {
      const array = this.transformExpression(node.array);
      const elements = (node.elements || []).map(e => this.transformExpression(e));
      return new RubyMethodCall(array, 'push', elements);
    }

    /**
     * Transform ArraySlice IL node
     * Ruby: array[start, length] or array[start..end]
     */
    transformArraySlice(node) {
      const array = this.transformExpression(node.array);
      const start = this.transformExpression(node.start);

      if (node.end) {
        const end = this.transformExpression(node.end);
        // Ruby uses exclusive range with ...
        return new RubyIndex(array, new RubyRange(start, end, true));
      } else if (node.length) {
        const length = this.transformExpression(node.length);
        // array[start, length]
        return new RubyMethodCall(array, 'slice', [start, length]);
      } else {
        // array[start..-1]
        return new RubyIndex(array, new RubyRange(start, RubyLiteral.Integer(-1), false));
      }
    }

    /**
     * Transform ArrayFill IL node
     * Ruby: array.fill(value) or Array.new(size, value)
     */
    transformArrayFill(node) {
      if (node.array) {
        const array = this.transformExpression(node.array);
        const value = this.transformExpression(node.value);
        return new RubyMethodCall(array, 'fill', [value]);
      } else {
        const size = this.transformExpression(node.size);
        const value = node.value ? this.transformExpression(node.value) : RubyLiteral.Integer(0);
        return new RubyMethodCall(new RubyIdentifier('Array'), 'new', [size, value]);
      }
    }

    /**
     * Transform ArrayXor IL node
     * Ruby: a.zip(b).map { |x, y| x ^ y }
     */
    transformArrayXor(node) {
      const left = this.transformExpression(node.left);
      const right = this.transformExpression(node.right);

      return new RubyMethodCall(
        new RubyMethodCall(left, 'zip', [right]),
        'map',
        [],
        new RubyBlockExpression(
          [new RubyParameter('x'), new RubyParameter('y')],
          this.wrapInBlock(new RubyExpressionStatement(
            new RubyBinaryExpression(new RubyIdentifier('x'), '^', new RubyIdentifier('y'))
          ))
        )
      );
    }

    /**
     * Transform ArrayClear IL node
     * Ruby: array.fill(0) for byte arrays, array.clear for general
     */
    transformArrayClear(node) {
      const array = this.transformExpression(node.array);
      // For byte arrays, fill with 0; for general, use clear
      return new RubyMethodCall(array, 'fill', [RubyLiteral.Integer(0)]);
    }

    /**
     * Transform ArrayCreation IL node
     * Ruby: Array.new(size) or Array.new(size, initial)
     */
    transformArrayCreation(node) {
      const size = this.transformExpression(node.size);
      if (node.initialValue) {
        const initial = this.transformExpression(node.initialValue);
        return new RubyMethodCall(new RubyIdentifier('Array'), 'new', [size, initial]);
      }
      return new RubyMethodCall(new RubyIdentifier('Array'), 'new', [size]);
    }

    /**
     * Transform TypedArrayCreation IL node
     * Ruby: Array.new(size, 0) - Ruby doesn't have typed arrays
     */
    transformTypedArrayCreation(node) {
      const size = this.transformExpression(node.size);
      // Initialize with 0 for typed arrays (byte arrays)
      return new RubyMethodCall(new RubyIdentifier('Array'), 'new', [size, RubyLiteral.Integer(0)]);
    }

    /**
     * Transform HexDecode IL node
     * Ruby: [hex_string].pack('H*').bytes
     */
    transformHexDecode(node) {
      // IL HexDecode nodes have arguments array, not value property
      const hexString = this.transformExpression(node.arguments?.[0] || node.value);
      return new RubyMethodCall(
        new RubyMethodCall(new RubyArrayLiteral([hexString]), 'pack', [RubyLiteral.String('H*')]),
        'bytes',
        []
      );
    }

    /**
     * Transform HexEncode IL node
     * Ruby: bytes.pack('C*').unpack1('H*')
     */
    transformHexEncode(node) {
      // IL HexEncode nodes have arguments array, not value property
      const bytes = this.transformExpression(node.arguments?.[0] || node.value);
      return new RubyMethodCall(
        new RubyMethodCall(bytes, 'pack', [RubyLiteral.String('C*')]),
        'unpack1',
        [RubyLiteral.String('H*')]
      );
    }

    /**
     * Transform Cast IL node
     * Ruby: value.to_i, value.to_f, etc.
     */
    transformCast(node) {
      const value = this.transformExpression(node.arguments?.[0] || node.value);
      const targetType = node.targetType || 'int32';

      // Map to Ruby conversion methods
      if (targetType.includes('int') || targetType.includes('uint') || targetType === 'byte') {
        return new RubyMethodCall(value, 'to_i', []);
      } else if (targetType.includes('float') || targetType === 'double') {
        return new RubyMethodCall(value, 'to_f', []);
      } else if (targetType === 'string' || targetType === 'String') {
        return new RubyMethodCall(value, 'to_s', []);
      }

      return value;
    }
  }

  // Export
  const exports = { RubyTransformer };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.RubyTransformer = RubyTransformer;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
