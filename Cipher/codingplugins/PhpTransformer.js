/**
 * PhpTransformer.js - JavaScript AST to PHP AST Transformer
 * Converts type-annotated JavaScript AST to PHP AST
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> PHP AST -> PHP Emitter -> PHP Source
 */

(function(global) {
  'use strict';

  // Load dependencies
  let PhpAST;
  if (typeof require !== 'undefined') {
    PhpAST = require('./PhpAST.js');
  } else if (global.PhpAST) {
    PhpAST = global.PhpAST;
  }

  const {
    PhpType, PhpFile, PhpNamespace, PhpUseDeclaration,
    PhpClass, PhpInterface, PhpTrait, PhpEnum, PhpEnumCase,
    PhpProperty, PhpMethod, PhpFunction, PhpParameter,
    PhpBlock, PhpVariableDeclaration, PhpExpressionStatement,
    PhpReturn, PhpIf, PhpFor, PhpForeach, PhpWhile, PhpDoWhile,
    PhpSwitch, PhpSwitchCase, PhpMatch, PhpMatchArm,
    PhpBreak, PhpContinue, PhpTry, PhpCatch, PhpThrow,
    PhpLiteral, PhpVariable, PhpIdentifier, PhpBinaryExpression, PhpUnaryExpression,
    PhpAssignment, PhpPropertyAccess, PhpStaticPropertyAccess, PhpArrayAccess,
    PhpMethodCall, PhpStaticMethodCall, PhpFunctionCall,
    PhpArrayLiteral, PhpNew, PhpTernary, PhpNullCoalescing,
    PhpInstanceof, PhpArrowFunction, PhpClosure, PhpCast,
    PhpStringInterpolation, PhpClassConstant, PhpDocComment, PhpConst
  } = PhpAST;

  /**
   * Maps JavaScript/IL types to PHP types
   */
  const TYPE_MAP = {
    // Unsigned integers (PHP doesn't distinguish, map to int)
    'uint8': 'int', 'byte': 'int',
    'uint16': 'int', 'ushort': 'int', 'word': 'int',
    'uint32': 'int', 'uint': 'int', 'dword': 'int',
    'uint64': 'int', 'ulong': 'int', 'qword': 'int',
    // Signed integers
    'int8': 'int', 'sbyte': 'int',
    'int16': 'int', 'short': 'int',
    'int32': 'int', 'int': 'int',
    'int64': 'int', 'long': 'int',
    // Floating point
    'float': 'float', 'float32': 'float',
    'double': 'float', 'float64': 'float',
    // JavaScript number maps to int|float
    'number': 'int',
    // Other
    'boolean': 'bool', 'bool': 'bool',
    'string': 'string', 'String': 'string',
    'void': 'void',
    'object': 'object',
    'array': 'array',
    'Array': 'array',
    'mixed': 'mixed',
    'null': 'null',
    'never': 'never'
  };

  /**
   * JavaScript AST to PHP AST Transformer
   *
   * Supported Options:
   * - indent: string - Indentation string (default: '    ')
   * - lineEnding: string - Line ending character (default: '\n')
   * - strictTypes: boolean - Add declare(strict_types=1). Default: true
   * - addTypeHints: boolean - Add type hints to parameters/returns. Default: true
   * - addDocBlocks: boolean - Add PHPDoc comments. Default: true
   * - useShortArraySyntax: boolean - Use [] instead of array(). Default: true
   * - useNullCoalescing: boolean - Use ?? operator. Default: true
   * - useMatchExpressions: boolean - Use match() instead of switch. Default: true
   * - useArrowFunctions: boolean - Use fn() => syntax. Default: true
   * - useConstructorPromotion: boolean - Use constructor property promotion. Default: true
   * - useReadonlyProperties: boolean - Use readonly keyword. Default: true
   */
  class PhpTransformer {
    constructor(options = {}) {
      this.options = options;
      this.currentClass = null;
      this.variableTypes = new Map();  // Maps variable name -> PhpType
      this.classFieldTypes = new Map(); // Maps field name -> PhpType
      this.nestedItems = [];
      this.scopeStack = [];
    }

    /**
     * Convert name to snake_case (PHP convention for functions/variables)
     */
    toSnakeCase(str) {
      if (!str) return str;
      if (typeof str !== 'string') str = String(str);
      return str
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '');
    }

    /**
     * Convert name to PascalCase (PHP convention for classes)
     */
    toPascalCase(str) {
      if (!str) return str;
      return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Convert name to SCREAMING_SNAKE_CASE (PHP convention for constants)
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
     * Map JavaScript type string to PHP type
     */
    mapType(typeName) {
      if (!typeName) return PhpType.Mixed();

      // Handle arrays
      if (typeName.endsWith('[]')) {
        const elementTypeName = typeName.slice(0, -2);
        const elementType = this.mapType(elementTypeName);
        return PhpType.TypedArray(elementType);
      }

      const phpTypeName = TYPE_MAP[typeName] || typeName;

      // Map to PHP types
      const typeMap = {
        'int': PhpType.Int(),
        'float': PhpType.Float(),
        'string': PhpType.String(),
        'bool': PhpType.Bool(),
        'array': PhpType.Array(),
        'object': PhpType.Object(),
        'mixed': PhpType.Mixed(),
        'void': PhpType.Void(),
        'null': PhpType.Null(),
        'callable': PhpType.Callable(),
        'iterable': PhpType.Iterable(),
        'never': PhpType.Never()
      };

      return typeMap[phpTypeName] || new PhpType(phpTypeName);
    }

    /**
     * Register a variable's type in the current scope
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
     * Push a new scope for nested functions
     */
    pushScope() {
      this.scopeStack.push(new Map(this.variableTypes));
    }

    /**
     * Pop scope when leaving nested function
     */
    popScope() {
      if (this.scopeStack.length > 0) {
        this.variableTypes = this.scopeStack.pop();
      }
    }

    /**
     * Infer PHP type from variable name pattern
     */
    inferTypeFromName(name) {
      if (!name) return PhpType.Mixed();

      const lowerName = name.toLowerCase();

      // Byte-related names
      if (lowerName.includes('byte') || lowerName === 'b' || /^b\d$/.test(lowerName)) {
        return PhpType.Int();
      }

      // Array-related names
      if (lowerName.includes('key') || lowerName.includes('data') ||
          lowerName.includes('input') || lowerName.includes('output') ||
          lowerName.includes('block') || lowerName.includes('bytes') ||
          lowerName.includes('buffer') || lowerName.includes('state')) {
        return PhpType.String(); // In PHP, byte arrays are strings
      }

      // Integer-related names
      if (lowerName.includes('index') || lowerName.includes('length') ||
          lowerName.includes('size') || lowerName.includes('count') ||
          lowerName === 'i' || lowerName === 'j' || lowerName === 'n') {
        return PhpType.Int();
      }

      // Default to int for crypto operations
      return PhpType.Int();
    }

    /**
     * Transform a JavaScript AST to a PHP AST
     * @param {Object} jsAst - JavaScript AST from parser
     * @returns {PhpFile} PHP AST
     */
    transform(jsAst) {
      const file = new PhpFile();

      // Configure strict types
      if (this.options.strictTypes !== false) {
        file.strictTypes = true;
      }

      // Add namespace if configured
      if (this.options.namespace) {
        file.namespace = new PhpNamespace(this.options.namespace);
      }

      // Add doc comment
      if (this.options.addDocBlocks !== false) {
        const docComment = new PhpDocComment(
          `Generated PHP code\nThis file was automatically generated from JavaScript AST`
        );
        file.items.unshift(docComment);
      }

      // Transform the JavaScript AST
      if (jsAst.type === 'Program') {
        for (const node of jsAst.body) {
          this.transformTopLevel(node, file);
        }
      }

      // Add nested items
      for (const nested of this.nestedItems) {
        file.items.push(nested);
      }

      return file;
    }

    /**
     * Transform a top-level JavaScript node
     */
    transformTopLevel(node, targetFile) {
      switch (node.type) {
        case 'VariableDeclaration':
          this.transformVariableDeclaration(node, targetFile);
          break;

        case 'FunctionDeclaration':
          this.transformFunctionDeclaration(node, targetFile);
          break;

        case 'ClassDeclaration':
          this.transformClassDeclaration(node, targetFile);
          break;

        case 'ExpressionStatement':
          // Handle IIFE wrappers - extract content from inside
          if (node.expression.type === 'CallExpression') {
            const callee = node.expression.callee;
            if (callee.type === 'FunctionExpression' ||
                callee.type === 'ArrowFunctionExpression') {
              this.transformIIFEContent(callee, node.expression, targetFile);
            }
          }
          break;

        default:
          // Skip unhandled top-level node types
          break;
      }
    }

    /**
     * Extract and transform content from IIFE wrapper
     */
    transformIIFEContent(calleeNode, callExpr, targetFile) {
      let bodyStatements = [];

      // Try to find the factory function in UMD pattern
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
          this.transformClassDeclaration(stmt, targetFile);
          continue;
        }
        if (stmt.type === 'FunctionDeclaration') {
          this.transformFunctionDeclaration(stmt, targetFile);
          continue;
        }
        if (stmt.type === 'VariableDeclaration') {
          this.transformVariableDeclaration(stmt, targetFile);
          continue;
        }
        if (stmt.type === 'IfStatement') continue;
      }
    }

    /**
     * Transform a variable declaration
     */
    transformVariableDeclaration(node, targetFile) {
      for (const decl of node.declarations) {
        if (!decl.init) continue;

        // Skip object destructuring
        if (decl.id.type === 'ObjectPattern') continue;

        // Handle array destructuring: const [a, b, c] = arr;
        // PHP supports list() unpacking: [$a, $b, $c] = $arr;
        if (decl.id.type === 'ArrayPattern') {
          const sourceExpr = decl.init ? this.transformExpression(decl.init) : null;
          if (sourceExpr) {
            for (let i = 0; i < decl.id.elements.length; ++i) {
              const elem = decl.id.elements[i];
              if (!elem) continue; // Skip holes in destructuring

              const varName = this.toSnakeCase(elem.name);
              const indexExpr = new PhpArrayAccess(sourceExpr, PhpLiteral.Int(i));
              const constDecl = new PhpConst(this.toScreamingSnakeCase(elem.name), null, indexExpr);
              targetFile.items.push(constDecl);
            }
          }
          continue;
        }

        const name = decl.id.name;

        // Check if this is a constant
        if (decl.init.type === 'Literal' ||
            decl.init.type === 'ArrayExpression' ||
            decl.init.type === 'UnaryExpression' ||
            decl.init.type === 'BinaryExpression') {
          const constDecl = new PhpConst(
            this.toScreamingSnakeCase(name),
            this.inferTypeFromValue(decl.init),
            this.transformExpression(decl.init)
          );
          targetFile.items.push(constDecl);
        }
      }
    }

    /**
     * Transform a function declaration
     */
    transformFunctionDeclaration(node, targetFile) {
      const funcName = this.toSnakeCase(node.id.name);
      const func = new PhpFunction(funcName);

      // Infer return type from returnType annotation or default to void
      if (node.returnType) {
        func.returnType = this.mapType(node.returnType);
      } else {
        func.returnType = PhpType.Void();
      }

      // Parameters
      if (node.params) {
        for (const param of node.params) {
          const paramName = this.toSnakeCase(param.name);
          let paramType = null;

          // Use typeAnnotation if available
          if (param.typeAnnotation) {
            paramType = this.mapType(param.typeAnnotation);
          } else {
            paramType = this.inferTypeFromName(param.name);
          }

          const phpParam = new PhpParameter(paramName, paramType);
          func.parameters.push(phpParam);

          this.registerVariableType(param.name, paramType);
        }
      }

      // Body
      if (node.body) {
        func.body = this.transformBlockStatement(node.body);
      }

      targetFile.items.push(func);
    }

    /**
     * Transform a class declaration to PHP class
     */
    transformClassDeclaration(node, targetFile) {
      const className = this.toPascalCase(node.id.name);
      const phpClass = new PhpClass(className);

      const prevClass = this.currentClass;
      this.currentClass = phpClass;

      // Handle both class body structures
      const members = node.body?.body || node.body || [];

      if (members && members.length > 0) {
        for (const member of members) {
          if (member.type === 'MethodDefinition') {
            if (member.kind === 'constructor') {
              // Constructor: extract properties and create constructor
              const { properties, initStatements } = this.extractPropertiesFromConstructor(member);

              for (const prop of properties) {
                phpClass.properties.push(prop);
              }

              const ctor = this.transformConstructor(member, className, initStatements);
              phpClass.methods.push(ctor);
            } else {
              // Regular method
              const method = this.transformMethodDefinition(member);
              phpClass.methods.push(method);
            }
          } else if (member.type === 'PropertyDefinition') {
            // Field
            const property = this.transformPropertyDefinition(member);
            phpClass.properties.push(property);
          } else if (member.type === 'StaticBlock') {
            // ES2022 static block -> PHP doesn't have static class blocks
            // Transform to statements in a static initialization method
            const initStatements = this.transformStaticBlock(member);
            if (initStatements) {
              phpClass.staticInitStatements = phpClass.staticInitStatements || [];
              phpClass.staticInitStatements.push(...initStatements);
            }
          }
        }
      }

      this.currentClass = prevClass;

      targetFile.items.push(phpClass);
    }

    /**
     * Check if a statement is a this.property = value assignment
     */
    isThisPropertyAssignment(stmt) {
      if (stmt.type !== 'ExpressionStatement') return false;
      const expr = stmt.expression;
      if (expr.type !== 'AssignmentExpression') return false;
      if (expr.left.type !== 'MemberExpression') return false;
      return expr.left.object.type === 'ThisExpression';
    }

    /**
     * Extract properties from constructor's this.x = y assignments
     */
    extractPropertiesFromConstructor(node) {
      const properties = [];
      const initStatements = [];

      if (!node.value || !node.value.body || node.value.body.type !== 'BlockStatement')
        return { properties, initStatements };

      for (const stmt of node.value.body.body) {
        if (this.isThisPropertyAssignment(stmt)) {
          const expr = stmt.expression;
          const propName = expr.left.property.name || expr.left.property.value;
          const isPrivate = propName.startsWith('_');

          let fieldName = this.toSnakeCase(propName);
          if (fieldName.startsWith('_'))
            fieldName = fieldName.substring(1);

          const value = expr.right;
          let fieldType = this.inferTypeFromValue(value);

          // Check for type annotation
          if (value.typeAnnotation) {
            fieldType = this.mapType(value.typeAnnotation);
          }

          // Handle null initializations
          if (value.type === 'Literal' && value.value === null) {
            fieldType = PhpType.Nullable(this.inferTypeFromName(propName));
          }

          const property = new PhpProperty(fieldName, fieldType);
          property.visibility = isPrivate ? 'private' : 'public';
          properties.push(property);
          this.classFieldTypes.set(fieldName, fieldType);

          initStatements.push(stmt);
        }
      }

      return { properties, initStatements };
    }

    /**
     * Transform a constructor
     */
    transformConstructor(node, className, fieldInitStatements = []) {
      const ctor = new PhpMethod('__construct');
      ctor.returnType = null; // Constructors don't have return types

      // Parameters
      if (node.value && node.value.params) {
        for (const param of node.value.params) {
          const paramName = this.toSnakeCase(param.name);
          let paramType = null;

          if (param.typeAnnotation) {
            paramType = this.mapType(param.typeAnnotation);
          } else {
            paramType = this.inferTypeFromName(param.name);
          }

          const phpParam = new PhpParameter(paramName, paramType);
          ctor.parameters.push(phpParam);

          this.registerVariableType(param.name, paramType);
        }
      }

      // Body
      const body = new PhpBlock();

      if (node.value && node.value.body && node.value.body.type === 'BlockStatement') {
        for (const stmt of node.value.body.body) {
          if (this.isThisPropertyAssignment(stmt)) {
            // Transform property assignment
            const expr = stmt.expression;
            const propName = expr.left.property.name || expr.left.property.value;
            let fieldName = this.toSnakeCase(propName);
            if (fieldName.startsWith('_'))
              fieldName = fieldName.substring(1);

            const target = new PhpPropertyAccess(
              new PhpVariable('this'),
              fieldName
            );
            const value = this.transformExpression(expr.right);
            const assignment = new PhpAssignment(target, '=', value);
            body.statements.push(new PhpExpressionStatement(assignment));
          } else {
            // Transform other statements
            const phpStmt = this.transformStatement(stmt);
            if (phpStmt) {
              if (Array.isArray(phpStmt))
                body.statements.push(...phpStmt);
              else
                body.statements.push(phpStmt);
            }
          }
        }
      }

      ctor.body = body;
      return ctor;
    }

    /**
     * Transform a method definition
     */
    transformMethodDefinition(node) {
      const methodName = this.toSnakeCase(node.key.name);
      const method = new PhpMethod(methodName);

      // Visibility
      method.visibility = 'public';
      if (node.static) {
        method.isStatic = true;
      }

      // Return type from annotation or inference
      if (node.value && node.value.returnType) {
        method.returnType = this.mapType(node.value.returnType);
      } else if (node.value && node.value.body) {
        const hasReturn = this.hasReturnWithValue(node.value.body);
        if (hasReturn) {
          const returnType = this.inferReturnType(node.value.body);
          if (returnType) {
            method.returnType = returnType;
          } else {
            method.returnType = PhpType.Void();
          }
        } else {
          method.returnType = PhpType.Void();
        }
      } else {
        method.returnType = PhpType.Void();
      }

      // Parameters
      if (node.value && node.value.params) {
        for (const param of node.value.params) {
          const paramName = this.toSnakeCase(param.name);
          let paramType = null;

          if (param.typeAnnotation) {
            paramType = this.mapType(param.typeAnnotation);
          } else {
            paramType = this.inferTypeFromName(param.name);
          }

          const phpParam = new PhpParameter(paramName, paramType);
          method.parameters.push(phpParam);

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
     * Check if body has return statement with value
     */
    hasReturnWithValue(bodyNode) {
      if (!bodyNode) return false;

      const check = (node) => {
        if (!node) return false;
        if (node.type === 'ReturnStatement' && node.argument) return true;

        for (const key in node) {
          if (key === 'type') continue;
          const value = node[key];
          if (Array.isArray(value)) {
            if (value.some(check)) return true;
          } else if (value && typeof value === 'object') {
            if (check(value)) return true;
          }
        }
        return false;
      };

      return check(bodyNode);
    }

    /**
     * Infer return type from return statements
     */
    inferReturnType(bodyNode) {
      if (!bodyNode) return null;

      const returnTypes = [];
      const collect = (node) => {
        if (!node) return;
        if (node.type === 'ReturnStatement' && node.argument) {
          returnTypes.push(this.inferTypeFromValue(node.argument));
        }

        for (const key in node) {
          if (key === 'type') continue;
          const value = node[key];
          if (Array.isArray(value)) {
            value.forEach(collect);
          } else if (value && typeof value === 'object') {
            collect(value);
          }
        }
      };

      collect(bodyNode);

      if (returnTypes.length === 0) return null;
      return returnTypes[0];
    }

    /**
     * Transform a property definition
     */
    transformPropertyDefinition(node) {
      const propertyName = this.toSnakeCase(node.key.name);
      let propertyType = PhpType.Mixed();

      if (node.value) {
        if (node.value.typeAnnotation) {
          propertyType = this.mapType(node.value.typeAnnotation);
        } else {
          propertyType = this.inferTypeFromValue(node.value);
        }
      }

      const property = new PhpProperty(propertyName, propertyType);
      this.classFieldTypes.set(propertyName, propertyType);

      return property;
    }

    transformStaticBlock(node) {
      // ES2022 static block -> PHP module-level statements
      // PHP doesn't have static class blocks, so transform to statements
      return node.body.map(stmt => this.transformStatement(stmt));
    }

    /**
     * Infer PHP type from a JavaScript value expression
     */
    inferTypeFromValue(valueNode) {
      if (!valueNode) return PhpType.Mixed();

      switch (valueNode.type) {
        case 'Literal':
          if (typeof valueNode.value === 'number') {
            if (Number.isInteger(valueNode.value)) {
              return PhpType.Int();
            }
            return PhpType.Float();
          }
          if (typeof valueNode.value === 'string') return PhpType.String();
          if (typeof valueNode.value === 'boolean') return PhpType.Bool();
          if (valueNode.value === null) return PhpType.Null();
          return PhpType.Mixed();

        case 'ArrayExpression':
          return PhpType.Array();

        default:
          return PhpType.Mixed();
      }
    }

    /**
     * Transform a block statement
     */
    transformBlockStatement(node) {
      const block = new PhpBlock();

      if (node.body && Array.isArray(node.body)) {
        for (const stmt of node.body) {
          const phpStmt = this.transformStatement(stmt);
          if (phpStmt) {
            if (Array.isArray(phpStmt)) {
              block.statements.push(...phpStmt);
            } else {
              block.statements.push(phpStmt);
            }
          }
        }
      }

      return block;
    }

    /**
     * Transform a statement (16 critical statement types)
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
          return new PhpBreak();

        case 'ContinueStatement':
          return new PhpContinue();

        case 'EmptyStatement':
          return null;

        default:
          return null;
      }
    }

    /**
     * Transform a variable declaration statement
     */
    transformLetStatement(node) {
      const statements = [];

      for (const decl of node.declarations) {
        const varName = this.toSnakeCase(decl.id.name);
        let varType = null;
        let initializer = null;

        if (decl.init) {
          initializer = this.transformExpression(decl.init);

          if (decl.id.typeAnnotation) {
            varType = this.mapType(decl.id.typeAnnotation);
          } else {
            varType = this.inferTypeFromValue(decl.init);
          }
        } else {
          varType = this.inferTypeFromName(decl.id.name);
        }

        const varDecl = new PhpVariableDeclaration(varName, varType, initializer);
        this.registerVariableType(decl.id.name, varType);
        statements.push(new PhpExpressionStatement(
          new PhpAssignment(new PhpVariable(varName), '=', initializer)
        ));
      }

      return statements;
    }

    /**
     * Transform an expression statement
     */
    transformExpressionStatementNode(node) {
      const expr = this.transformExpression(node.expression);
      if (!expr) return null;

      return new PhpExpressionStatement(expr);
    }

    /**
     * Transform a return statement
     */
    transformReturnStatement(node) {
      if (node.argument) {
        const expr = this.transformExpression(node.argument);
        return new PhpReturn(expr);
      }

      return new PhpReturn();
    }

    /**
     * Transform an if statement
     */
    transformIfStatement(node) {
      const condition = this.transformExpression(node.test);
      const thenBranch = this.transformStatement(node.consequent) || new PhpBlock();
      const elseBranch = node.alternate ? this.transformStatement(node.alternate) : null;

      const thenBlock = thenBranch.nodeType === 'Block' ? thenBranch : this.wrapInBlock(thenBranch);
      const elseBlock = elseBranch ? (elseBranch.nodeType === 'Block' ? elseBranch : this.wrapInBlock(elseBranch)) : null;

      return new PhpIf(condition, thenBlock, elseBlock);
    }

    /**
     * Transform a for statement
     */
    transformForStatement(node) {
      const init = node.init ? this.transformExpression(node.init) : null;
      const test = node.test ? this.transformExpression(node.test) : null;
      const update = node.update ? this.transformExpression(node.update) : null;
      const body = this.transformStatement(node.body) || new PhpBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      return new PhpFor(init, test, update, bodyBlock);
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
      const body = this.transformStatement(node.body) || new PhpBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      return new PhpForeach(iterable, varName, bodyBlock);
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
      const body = this.transformStatement(node.body) || new PhpBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      return new PhpForeach(object, varName, bodyBlock);
    }

    /**
     * Transform a while statement
     */
    transformWhileStatement(node) {
      const condition = this.transformExpression(node.test);
      const body = this.transformStatement(node.body) || new PhpBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      return new PhpWhile(condition, bodyBlock);
    }

    /**
     * Transform a do-while statement
     */
    transformDoWhileStatement(node) {
      const condition = this.transformExpression(node.test);
      const body = this.transformStatement(node.body) || new PhpBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      return new PhpDoWhile(condition, bodyBlock);
    }

    /**
     * Transform a switch statement
     */
    transformSwitchStatement(node) {
      const discriminant = this.transformExpression(node.discriminant);
      const switchStmt = new PhpSwitch(discriminant);

      for (const caseNode of node.cases) {
        const testExpr = caseNode.test ? this.transformExpression(caseNode.test) : null;
        const statements = [];

        for (const stmt of caseNode.consequent) {
          const phpStmt = this.transformStatement(stmt);
          if (phpStmt) {
            if (Array.isArray(phpStmt)) {
              statements.push(...phpStmt);
            } else {
              statements.push(phpStmt);
            }
          }
        }

        const caseStmt = new PhpSwitchCase(testExpr, statements);
        switchStmt.cases.push(caseStmt);
      }

      return switchStmt;
    }

    /**
     * Transform a try-catch statement
     */
    transformTryStatement(node) {
      const tryBlock = this.transformStatement(node.block);
      const tryStmt = new PhpTry(tryBlock);

      if (node.handler) {
        const exceptionType = node.handler.param?.typeAnnotation || 'Exception';
        const varName = node.handler.param ? this.toSnakeCase(node.handler.param.name) : 'e';
        const catchBody = this.transformStatement(node.handler.body);

        const catchClause = new PhpCatch([exceptionType], varName, catchBody);
        tryStmt.catchClauses.push(catchClause);
      }

      if (node.finalizer) {
        tryStmt.finallyBlock = this.transformStatement(node.finalizer);
      }

      return tryStmt;
    }

    /**
     * Transform a throw statement
     */
    transformThrowStatement(node) {
      const expr = node.argument ? this.transformExpression(node.argument) :
        new PhpNew('Exception', [PhpLiteral.String('Error')]);
      return new PhpThrow(expr);
    }

    /**
     * Wrap a statement in a block
     */
    wrapInBlock(stmt) {
      const block = new PhpBlock();
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
     * Transform an expression (19 critical expression types)
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
          return new PhpVariable('this');

        case 'Super':
          return new PhpIdentifier('parent');

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

        case 'ChainExpression':
          return this.transformExpression(node.expression);

        case 'ObjectPattern':
          // Object destructuring - PHP doesn't support this directly
          // Return a comment placeholder
          return new PhpIdentifier('/* Object destructuring not supported in PHP */');

        default:
          return null;
      }
    }

    /**
     * Transform an identifier
     */
    transformIdentifier(node) {
      let name = node.name;

      // Map JavaScript keywords to PHP equivalents
      if (name === 'undefined') return PhpLiteral.Null();
      if (name === 'null') return PhpLiteral.Null();
      if (name === 'NaN') return new PhpFunctionCall('NAN', []);
      if (name === 'Infinity') return new PhpFunctionCall('INF', []);

      return new PhpVariable(this.toSnakeCase(name));
    }

    /**
     * Transform a literal
     */
    transformLiteral(node) {
      if (typeof node.value === 'number') {
        if (Number.isInteger(node.value)) {
          return PhpLiteral.Int(node.value);
        }
        return PhpLiteral.Float(node.value);
      }

      if (typeof node.value === 'string') {
        return PhpLiteral.String(node.value);
      }

      if (typeof node.value === 'boolean') {
        return PhpLiteral.Bool(node.value);
      }

      if (node.value === null) {
        return PhpLiteral.Null();
      }

      return PhpLiteral.Null();
    }

    /**
     * Transform a binary expression
     */
    transformBinaryExpression(node) {
      let left = this.transformExpression(node.left);
      let right = this.transformExpression(node.right);

      let operator = node.operator;
      if (operator === '===') operator = '===';
      if (operator === '!==') operator = '!==';
      if (operator === '>>>' || operator === '>>>') operator = '>>';

      return new PhpBinaryExpression(left, operator, right);
    }

    /**
     * Transform a unary expression
     */
    transformUnaryExpression(node) {
      const operand = this.transformExpression(node.argument);
      return new PhpUnaryExpression(node.operator, operand, node.prefix);
    }

    /**
     * Transform an assignment expression
     */
    transformAssignmentExpression(node) {
      const left = this.transformExpression(node.left);
      const right = this.transformExpression(node.right);

      return new PhpAssignment(left, node.operator, right);
    }

    /**
     * Transform an update expression (++, --)
     */
    transformUpdateExpression(node) {
      const operand = this.transformExpression(node.argument);
      return new PhpUnaryExpression(node.operator, operand, node.prefix);
    }

    /**
     * Transform a member expression
     */
    transformMemberExpression(node) {
      const object = this.transformExpression(node.object);

      if (node.computed) {
        const index = this.transformExpression(node.property);
        return new PhpArrayAccess(object, index);
      } else {
        const field = node.property.name || node.property.value;
        let fieldName = this.toSnakeCase(field);

        // Remove leading underscore for $this->property access
        if (node.object.type === 'ThisExpression' && fieldName.startsWith('_'))
          fieldName = fieldName.substring(1);

        return new PhpPropertyAccess(object, fieldName);
      }
    }

    /**
     * Transform a call expression
     */
    transformCallExpression(node) {
      // Handle OpCodes method calls
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'OpCodes') {
        return this.transformOpCodesCall(node);
      }

      // Handle method calls
      if (node.callee.type === 'MemberExpression') {
        const object = this.transformExpression(node.callee.object);
        const method = node.callee.property.name || node.callee.property.value;
        const methodName = this.toSnakeCase(method);
        const args = node.arguments.map(arg => this.transformExpression(arg));

        return new PhpMethodCall(object, methodName, args);
      }

      // Regular function call
      const callee = this.transformExpression(node.callee);
      const args = node.arguments.map(arg => this.transformExpression(arg));

      if (callee.nodeType === 'Variable') {
        return new PhpFunctionCall(callee.name, args);
      }

      return new PhpFunctionCall(callee, args);
    }

    /**
     * Transform OpCodes method calls to PHP equivalents
     */
    transformOpCodesCall(node) {
      const methodName = node.callee.property.name;
      const args = node.arguments.map(arg => this.transformExpression(arg));

      switch (methodName) {
        case 'RotL32':
        case 'RotR32':
          // ($value << $positions) | ($value >> (32 - $positions))
          const value = args[0];
          const positions = args[1];
          const isLeft = methodName === 'RotL32';

          return new PhpBinaryExpression(
            new PhpBinaryExpression(value, isLeft ? '<<' : '>>', positions),
            '|',
            new PhpBinaryExpression(value, isLeft ? '>>' : '<<',
              new PhpBinaryExpression(PhpLiteral.Int(32), '-', positions))
          );

        case 'Pack32LE':
        case 'Pack32BE':
          // pack('V', ...) for little-endian, pack('N', ...) for big-endian
          const format = methodName.endsWith('LE') ? 'V' : 'N';
          return new PhpFunctionCall('pack', [
            PhpLiteral.String(format + '*'),
            ...args
          ]);

        case 'Unpack32LE':
        case 'Unpack32BE':
          const unpackFormat = methodName.endsWith('LE') ? 'V' : 'N';
          return new PhpFunctionCall('unpack', [
            PhpLiteral.String(unpackFormat + '*'),
            args[0]
          ]);

        case 'XorArrays':
          // array_map(fn($a, $b) => $a ^ $b, $arr1, $arr2)
          const xorFunc = new PhpArrowFunction(
            [new PhpParameter('a'), new PhpParameter('b')],
            new PhpBinaryExpression(new PhpVariable('a'), '^', new PhpVariable('b'))
          );
          return new PhpFunctionCall('array_map', [xorFunc, ...args]);

        case 'ClearArray':
          // sodium_memzero($array)
          return new PhpFunctionCall('sodium_memzero', args);

        case 'Hex8ToBytes':
          return new PhpFunctionCall('hex2bin', args);

        case 'BytesToHex8':
          return new PhpFunctionCall('bin2hex', args);

        case 'AnsiToBytes':
          return args[0]; // String is already bytes in PHP

        default:
          return new PhpFunctionCall(this.toSnakeCase(methodName), args);
      }
    }

    /**
     * Transform an array expression
     */
    transformArrayExpression(node) {
      const elements = [];
      for (let i = 0; i < node.elements.length; i++) {
        const elem = node.elements[i];
        if (elem) {
          const value = this.transformExpression(elem);
          elements.push({ key: null, value });
        }
      }

      return new PhpArrayLiteral(elements);
    }

    /**
     * Transform an object expression to PHP array
     */
    transformObjectExpression(node) {
      const elements = [];
      for (const prop of node.properties) {
        if (!prop.key) continue;

        const key = prop.key.name || prop.key.value || 'unknown';
        const value = this.transformExpression(prop.value);
        elements.push({
          key: PhpLiteral.String(this.toSnakeCase(key)),
          value
        });
      }

      return new PhpArrayLiteral(elements);
    }

    /**
     * Transform a new expression
     */
    transformNewExpression(node) {
      if (node.callee.type === 'Identifier') {
        const className = this.toPascalCase(node.callee.name);
        const args = node.arguments.map(arg => this.transformExpression(arg));

        return new PhpNew(className, args);
      }

      return null;
    }

    /**
     * Transform a conditional expression
     */
    transformConditionalExpression(node) {
      const condition = this.transformExpression(node.test);
      const thenExpr = this.transformExpression(node.consequent);
      const elseExpr = this.transformExpression(node.alternate);

      return new PhpTernary(condition, thenExpr, elseExpr);
    }

    /**
     * Transform a function expression to PHP closure
     */
    transformFunctionExpression(node) {
      const params = node.params ? node.params.map(p => {
        const paramName = this.toSnakeCase(p.name);
        const paramType = p.typeAnnotation ? this.mapType(p.typeAnnotation) : null;
        return new PhpParameter(paramName, paramType);
      }) : [];

      let body = null;
      if (node.body) {
        if (node.body.type === 'BlockStatement') {
          body = this.transformBlockStatement(node.body);
        } else {
          // Arrow function with expression body
          if (this.options.useArrowFunctions !== false) {
            return new PhpArrowFunction(params, this.transformExpression(node.body));
          } else {
            body = this.wrapInBlock(new PhpReturn(this.transformExpression(node.body)));
          }
        }
      }

      return new PhpClosure(params, body);
    }

    /**
     * Transform spread element
     */
    transformSpreadElement(node) {
      return this.transformExpression(node.argument);
    }

    /**
     * Transform template literal
     */
    transformTemplateLiteral(node) {
      const parts = [];

      for (let i = 0; i < node.quasis.length; i++) {
        const text = node.quasis[i].value.raw;
        if (text) parts.push(text);

        if (i < node.expressions.length) {
          parts.push(this.transformExpression(node.expressions[i]));
        }
      }

      return new PhpStringInterpolation(parts);
    }
  }

  // Export
  const exports = { PhpTransformer };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.PhpTransformer = PhpTransformer;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
