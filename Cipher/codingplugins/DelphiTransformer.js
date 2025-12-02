/**
 * DelphiTransformer.js - JavaScript AST to Delphi AST Transformer
 * Converts type-annotated JavaScript AST (IL AST) to Delphi AST
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> Delphi AST -> Delphi Emitter -> Delphi Source
 */

(function(global) {
  'use strict';

  // Load dependencies
  let DelphiAST;
  if (typeof require !== 'undefined') {
    DelphiAST = require('./DelphiAST.js');
  } else if (global.DelphiAST) {
    DelphiAST = global.DelphiAST;
  }

  const {
    DelphiType, DelphiUnit, DelphiInterfaceSection, DelphiImplementationSection,
    DelphiUsesClause, DelphiClass, DelphiRecord, DelphiField, DelphiProperty,
    DelphiInterface, DelphiFunction, DelphiProcedure, DelphiMethod,
    DelphiConstructor, DelphiDestructor, DelphiParameter, DelphiBlock,
    DelphiVarDeclaration, DelphiConstDeclaration, DelphiExpressionStatement,
    DelphiAssignment, DelphiIf, DelphiFor, DelphiForIn, DelphiWhile, DelphiRepeat,
    DelphiCase, DelphiCaseBranch, DelphiTry, DelphiExceptBlock,
    DelphiExceptionHandler, DelphiRaise, DelphiExit, DelphiBreak, DelphiContinue,
    DelphiLiteral, DelphiIdentifier, DelphiBinaryExpression, DelphiUnaryExpression,
    DelphiFieldAccess, DelphiArrayAccess, DelphiCall, DelphiTypeCast,
    DelphiTypeCheck, DelphiTypeCastAs, DelphiArrayLiteral, DelphiSetLiteral,
    DelphiRange, DelphiWith, DelphiComment
  } = DelphiAST;

  /**
   * Maps IL (Intermediate Language) types to Delphi types
   * IL types come from JavaScript type annotations and inference
   */
  const TYPE_MAP = {
    // Unsigned integers
    'uint8': 'Byte', 'byte': 'Byte',
    'uint16': 'Word', 'ushort': 'Word', 'word': 'Word',
    'uint32': 'Cardinal', 'uint': 'Cardinal', 'dword': 'Cardinal', 'cardinal': 'Cardinal',
    'uint64': 'UInt64', 'ulong': 'UInt64', 'qword': 'UInt64',
    // Signed integers
    'int8': 'ShortInt', 'sbyte': 'ShortInt',
    'int16': 'SmallInt', 'short': 'SmallInt',
    'int32': 'Integer', 'int': 'Integer', 'integer': 'Integer',
    'int64': 'Int64', 'long': 'Int64',
    // Floating point
    'float': 'Single', 'float32': 'Single', 'single': 'Single',
    'double': 'Double', 'float64': 'Double',
    // In crypto context, JavaScript 'number' typically means Cardinal (for bit operations)
    'number': 'Cardinal',
    // Other
    'boolean': 'Boolean', 'bool': 'Boolean',
    'string': 'string', 'String': 'string',
    'void': '', // Procedures have no return type
    'object': 'TObject',
    'Array': 'array of',
    'any': 'Variant'
  };

  /**
   * JavaScript AST to Delphi AST Transformer
   */
  class DelphiTransformer {
    constructor(options = {}) {
      this.options = options;
      this.unitName = options.unitName || 'GeneratedUnit';
      this.currentClass = null;
      this.currentMethod = null;
      this.variableTypes = new Map();
      this.fieldTypes = new Map();
      this.scopeStack = [];
      this.inConstructor = false;
    }

    /**
     * Convert name to PascalCase (Delphi convention for types/classes)
     */
    toPascalCase(str) {
      if (!str) return str;
      // If already starts with T and next char is uppercase, keep it
      if (/^T[A-Z]/.test(str)) return str;
      // If starts with lowercase t, convert to uppercase T
      if (/^t[A-Z]/.test(str)) return 'T' + str.slice(1);
      // Otherwise, capitalize first letter
      return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Convert name to camelCase (Delphi convention for variables/fields)
     */
    toCamelCase(str) {
      if (!str || typeof str !== 'string') return str || 'Unknown';
      // Remove leading underscore
      if (str.startsWith('_')) str = str.substring(1);
      return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Convert name to SCREAMING_SNAKE_CASE (Delphi convention for constants)
     */
    toScreamingCase(str) {
      if (!str || typeof str !== 'string') return str || 'Unknown';
      return str
        .replace(/([A-Z])/g, '_$1')
        .toUpperCase()
        .replace(/^_/, '');
    }

    /**
     * Map IL type to Delphi type
     */
    mapType(typeName) {
      if (!typeName) return DelphiType.Cardinal();

      // Handle arrays
      if (typeName.endsWith('[]')) {
        const elementTypeName = typeName.slice(0, -2);
        const elementType = this.mapType(elementTypeName);
        return DelphiType.Array(elementType);
      }

      const delphiTypeName = TYPE_MAP[typeName] || typeName;

      // Map to Delphi types
      const typeMap = {
        'Byte': DelphiType.Byte(),
        'Word': DelphiType.Word(),
        'Cardinal': DelphiType.Cardinal(),
        'LongWord': DelphiType.LongWord(),
        'UInt64': DelphiType.UInt64(),
        'ShortInt': DelphiType.ShortInt(),
        'SmallInt': DelphiType.SmallInt(),
        'Integer': DelphiType.Integer(),
        'Int64': DelphiType.Int64(),
        'Single': DelphiType.Single(),
        'Double': DelphiType.Double(),
        'Boolean': DelphiType.Boolean(),
        'string': DelphiType.String(),
        '': null, // void (procedures)
        'TObject': DelphiType.TObject(),
        'TBytes': DelphiType.TBytes()
      };

      return typeMap[delphiTypeName] || new DelphiType(delphiTypeName);
    }

    /**
     * Infer Delphi type from variable name pattern
     */
    inferTypeFromName(name) {
      if (!name) return DelphiType.Cardinal();

      const lowerName = name.toLowerCase();

      // Byte-related names
      if (lowerName.includes('byte') || lowerName === 'b' || /^b\d$/.test(lowerName)) {
        return DelphiType.Byte();
      }

      // Array-related names (crypto data)
      if (lowerName.includes('key') || lowerName.includes('data') ||
          lowerName.includes('input') || lowerName.includes('output') ||
          lowerName.includes('block') || lowerName.includes('bytes') ||
          lowerName.includes('buffer') || lowerName.includes('state')) {
        return DelphiType.TBytes();
      }

      // Index/length names
      if (lowerName.includes('index') || lowerName.includes('length') ||
          lowerName.includes('size') || lowerName.includes('count') ||
          lowerName === 'i' || lowerName === 'j' || lowerName === 'n') {
        return DelphiType.Integer();
      }

      // Default to Cardinal for crypto operations
      return DelphiType.Cardinal();
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
     * Transform a JavaScript AST to a Delphi AST
     * @param {Object} jsAst - Type-annotated JavaScript AST (IL AST)
     * @returns {DelphiUnit} Delphi AST
     */
    transform(jsAst) {
      const unit = new DelphiUnit(this.unitName);

      // Add standard uses
      unit.interfaceSection.uses.push(
        new DelphiUsesClause(['System', 'SysUtils', 'Classes'])
      );

      // Transform the JavaScript AST
      if (jsAst.type === 'Program') {
        for (const node of jsAst.body) {
          this.transformTopLevel(node, unit);
        }
      }

      return unit;
    }

    /**
     * Transform a top-level JavaScript node
     */
    transformTopLevel(node, targetUnit) {
      switch (node.type) {
        case 'VariableDeclaration':
          this.transformTopLevelVariableDeclaration(node, targetUnit);
          break;

        case 'FunctionDeclaration':
          this.transformFunctionDeclaration(node, targetUnit);
          break;

        case 'ClassDeclaration':
          this.transformClassDeclaration(node, targetUnit);
          break;

        case 'ExpressionStatement':
          // Handle IIFE wrappers - extract content from inside
          if (node.expression && node.expression.type === 'CallExpression') {
            const callee = node.expression.callee;
            if (callee.type === 'FunctionExpression' || callee.type === 'ArrowFunctionExpression') {
              this.transformIIFEContent(callee, node.expression, targetUnit);
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
    transformIIFEContent(calleeNode, callExpr, targetUnit) {
      let bodyStatements = [];

      // Try to find factory function in UMD pattern
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
        if (stmt.type === 'ClassDeclaration') {
          this.transformClassDeclaration(stmt, targetUnit);
        } else if (stmt.type === 'FunctionDeclaration') {
          this.transformFunctionDeclaration(stmt, targetUnit);
        } else if (stmt.type === 'VariableDeclaration') {
          this.transformTopLevelVariableDeclaration(stmt, targetUnit);
        }
      }
    }

    /**
     * Transform top-level variable declaration (becomes const or type)
     */
    transformTopLevelVariableDeclaration(node, targetUnit) {
      for (const decl of node.declarations) {
        if (!decl.init) continue;

        // Skip object destructuring
        if (decl.id.type === 'ObjectPattern') continue;

        // Handle array destructuring: const [a, b, c] = arr;
        if (decl.id.type === 'ArrayPattern') {
          const sourceExpr = decl.init ? this.transformExpression(decl.init) : null;
          if (sourceExpr) {
            for (let i = 0; i < decl.id.elements.length; ++i) {
              const elem = decl.id.elements[i];
              if (!elem) continue; // Skip holes in destructuring

              const varName = this.toPascalCase(elem.name);
              const indexExpr = new DelphiArrayAccess(sourceExpr, DelphiLiteral.Integer(i));
              const constDecl = new DelphiConstDeclaration(varName, indexExpr, null);
              targetUnit.interfaceSection.constants.push(constDecl);
            }
          }
          continue;
        }

        const name = decl.id.name;

        // Object literals become records/classes
        if (decl.init.type === 'ObjectExpression') {
          const record = this.transformObjectToRecord(name, decl.init);
          if (record) {
            targetUnit.interfaceSection.types.push(record);
          }
        }
        // Simple literals become constants
        else if (decl.init.type === 'Literal' || decl.init.type === 'UnaryExpression') {
          const value = this.transformExpression(decl.init);
          const type = this.inferTypeFromValue(decl.init);
          const constDecl = new DelphiConstDeclaration(
            this.toScreamingCase(name),
            value,
            type
          );
          targetUnit.interfaceSection.constants.push(constDecl);
        }
      }
    }

    /**
     * Transform object literal to Delphi record
     */
    transformObjectToRecord(name, objNode) {
      const record = new DelphiRecord(this.toPascalCase(name));
      record.isAdvanced = true; // Advanced records can have methods

      for (const prop of objNode.properties) {
        const propName = prop.key.name || prop.key.value;
        const propValue = prop.value;

        if (prop.method || propValue.type === 'FunctionExpression' || propValue.type === 'ArrowFunctionExpression') {
          // Skip methods in records for now
        } else {
          // Field
          const field = new DelphiField(
            this.toCamelCase(propName),
            this.inferTypeFromValue(propValue)
          );
          record.fields.push(field);
        }
      }

      return record;
    }

    /**
     * Infer Delphi type from JavaScript value
     */
    inferTypeFromValue(valueNode) {
      if (!valueNode) return DelphiType.Cardinal();

      switch (valueNode.type) {
        case 'Literal':
          if (typeof valueNode.value === 'number') {
            if (Number.isInteger(valueNode.value)) {
              return valueNode.value >= 0 ? DelphiType.Cardinal() : DelphiType.Integer();
            }
            return DelphiType.Double();
          }
          if (typeof valueNode.value === 'string') return DelphiType.String();
          if (typeof valueNode.value === 'boolean') return DelphiType.Boolean();
          return DelphiType.Cardinal();

        case 'ArrayExpression':
          if (valueNode.elements.length > 0) {
            const elemType = this.inferTypeFromValue(valueNode.elements[0]);
            return DelphiType.Array(elemType);
          }
          return DelphiType.TBytes();

        default:
          return DelphiType.Cardinal();
      }
    }

    /**
     * Transform function declaration
     */
    transformFunctionDeclaration(node, targetUnit) {
      const funcName = this.toPascalCase(node.id.name);

      // Determine if function or procedure based on return type
      const returnType = node.returnType ? this.mapType(node.returnType) : null;
      const hasReturn = this.hasReturnWithValue(node.body);

      if (returnType || hasReturn) {
        // Function
        const func = new DelphiFunction(funcName, returnType || DelphiType.Cardinal());

        // Parameters
        if (node.params) {
          for (const param of node.params) {
            const paramName = this.toCamelCase(param.name);
            const paramType = param.typeAnnotation ?
              this.mapType(param.typeAnnotation) :
              this.inferTypeFromName(param.name);
            const delphiParam = new DelphiParameter(paramName, paramType);
            func.parameters.push(delphiParam);
            this.registerVariableType(param.name, paramType);
          }
        }

        // Body
        if (node.body) {
          func.body = this.transformBlockStatement(node.body);
        }

        targetUnit.interfaceSection.functions.push(func);
        targetUnit.implementationSection.functions.push(func);
      } else {
        // Procedure
        const proc = new DelphiProcedure(funcName);

        // Parameters
        if (node.params) {
          for (const param of node.params) {
            const paramName = this.toCamelCase(param.name);
            const paramType = param.typeAnnotation ?
              this.mapType(param.typeAnnotation) :
              this.inferTypeFromName(param.name);
            const delphiParam = new DelphiParameter(paramName, paramType);
            proc.parameters.push(delphiParam);
            this.registerVariableType(param.name, paramType);
          }
        }

        // Body
        if (node.body) {
          proc.body = this.transformBlockStatement(node.body);
        }

        targetUnit.interfaceSection.procedures.push(proc);
        targetUnit.implementationSection.procedures.push(proc);
      }
    }

    /**
     * Check if function body has return statement with value
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
     * Transform class declaration
     */
    transformClassDeclaration(node, targetUnit) {
      const className = this.toPascalCase(node.id.name);
      const delphiClass = new DelphiClass(className);

      // Inheritance
      if (node.superClass && node.superClass.name) {
        delphiClass.heritage = this.toPascalCase(node.superClass.name);
      } else {
        delphiClass.heritage = 'TObject';
      }

      const prevClass = this.currentClass;
      this.currentClass = delphiClass;

      // Process class members
      const members = node.body?.body || node.body || [];

      for (const member of members) {
        if (member.type === 'MethodDefinition') {
          if (member.kind === 'constructor') {
            // Constructor
            const ctor = this.transformConstructor(member);
            delphiClass.constructor_methods.push(ctor);
          } else if (member.kind === 'method') {
            // Method
            const method = this.transformMethodDefinition(member);
            delphiClass.methods.push(method);
          }
        } else if (member.type === 'PropertyDefinition') {
          // Field
          const field = this.transformPropertyToField(member);
          delphiClass.fields.push(field);
        } else if (member.type === 'StaticBlock') {
          // ES2022 static block -> Delphi class initialization section
          const initStatements = this.transformStaticBlock(member);
          if (initStatements) {
            delphiClass.staticInitStatements = delphiClass.staticInitStatements || [];
            delphiClass.staticInitStatements.push(...initStatements);
          }
        }
      }

      this.currentClass = prevClass;

      targetUnit.interfaceSection.types.push(delphiClass);
    }

    /**
     * Transform constructor
     */
    transformConstructor(node) {
      const ctor = new DelphiConstructor('Create');

      this.inConstructor = true;

      // Parameters
      if (node.value && node.value.params) {
        for (const param of node.value.params) {
          const paramName = this.toCamelCase(param.name);
          const paramType = param.typeAnnotation ?
            this.mapType(param.typeAnnotation) :
            this.inferTypeFromName(param.name);
          const delphiParam = new DelphiParameter(paramName, paramType);
          ctor.parameters.push(delphiParam);
          this.registerVariableType(param.name, paramType);
        }
      }

      // Body
      if (node.value && node.value.body) {
        ctor.body = this.transformBlockStatement(node.value.body);
      }

      this.inConstructor = false;

      return ctor;
    }

    /**
     * Transform method definition
     */
    transformMethodDefinition(node) {
      const methodName = this.toPascalCase(node.key.name);

      // Check if function or procedure
      const returnType = node.value.returnType ? this.mapType(node.value.returnType) : null;
      const hasReturn = this.hasReturnWithValue(node.value.body);

      const method = new DelphiMethod(
        methodName,
        returnType || hasReturn,
        returnType || (hasReturn ? DelphiType.Cardinal() : null)
      );

      const prevMethod = this.currentMethod;
      this.currentMethod = method;

      // Parameters
      if (node.value && node.value.params) {
        for (const param of node.value.params) {
          const paramName = this.toCamelCase(param.name);
          const paramType = param.typeAnnotation ?
            this.mapType(param.typeAnnotation) :
            this.inferTypeFromName(param.name);
          const delphiParam = new DelphiParameter(paramName, paramType);
          method.parameters.push(delphiParam);
          this.registerVariableType(param.name, paramType);
        }
      }

      // Body
      if (node.value && node.value.body) {
        method.body = this.transformBlockStatement(node.value.body);
      }

      this.currentMethod = prevMethod;

      return method;
    }

    /**
     * Transform property definition to field
     */
    transformPropertyToField(node) {
      const fieldName = 'F' + this.toCamelCase(node.key.name);
      let fieldType = DelphiType.Cardinal();

      if (node.value) {
        fieldType = this.inferTypeFromValue(node.value);
      } else if (node.typeAnnotation) {
        fieldType = this.mapType(node.typeAnnotation);
      }

      const field = new DelphiField(fieldName, fieldType);
      field.visibility = 'private';

      this.fieldTypes.set(fieldName, fieldType);

      return field;
    }

    transformStaticBlock(node) {
      // ES2022 static block -> Delphi initialization/finalization section
      // Transform to statements that will be emitted in initialization section
      return node.body.map(stmt => this.transformStatement(stmt));
    }

    /**
     * Transform block statement
     */
    transformBlockStatement(node) {
      const block = new DelphiBlock();

      if (node.body && Array.isArray(node.body)) {
        for (const stmt of node.body) {
          const delphiStmt = this.transformStatement(stmt);
          if (delphiStmt) {
            if (Array.isArray(delphiStmt)) {
              block.statements.push(...delphiStmt);
            } else {
              block.statements.push(delphiStmt);
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
          return this.transformVariableDeclarationStatement(node);

        case 'ExpressionStatement':
          return this.transformExpressionStatement(node);

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
          return new DelphiBreak();

        case 'ContinueStatement':
          return new DelphiContinue();

        case 'EmptyStatement':
          return null;

        default:
          return null;
      }
    }

    /**
     * Transform variable declaration statement
     */
    transformVariableDeclarationStatement(node) {
      const statements = [];

      for (const decl of node.declarations) {
        const varName = this.toCamelCase(decl.id.name);
        let varType = null;
        let initializer = null;

        if (decl.init) {
          initializer = this.transformExpression(decl.init);
          varType = decl.typeAnnotation ?
            this.mapType(decl.typeAnnotation) :
            this.inferTypeFromValue(decl.init);
        } else {
          varType = decl.typeAnnotation ?
            this.mapType(decl.typeAnnotation) :
            this.inferTypeFromName(decl.id.name);
        }

        const varDecl = new DelphiVarDeclaration(varName, varType, initializer);
        this.registerVariableType(decl.id.name, varType);
        statements.push(varDecl);
      }

      return statements;
    }

    /**
     * Transform expression statement
     */
    transformExpressionStatement(node) {
      const expr = this.transformExpression(node.expression);
      if (!expr) return null;

      // Check if it's an assignment
      if (node.expression.type === 'AssignmentExpression') {
        const left = this.transformExpression(node.expression.left);
        const right = this.transformExpression(node.expression.right);
        return new DelphiAssignment(left, right);
      }

      return new DelphiExpressionStatement(expr);
    }

    /**
     * Transform return statement
     */
    transformReturnStatement(node) {
      if (node.argument) {
        const expr = this.transformExpression(node.argument);
        return new DelphiExit(expr);
      }
      return new DelphiExit();
    }

    /**
     * Transform if statement
     */
    transformIfStatement(node) {
      const condition = this.transformExpression(node.test);
      const thenBranch = this.transformStatement(node.consequent) || new DelphiBlock();
      const elseBranch = node.alternate ? this.transformStatement(node.alternate) : null;

      return new DelphiIf(condition, thenBranch, elseBranch);
    }

    /**
     * Transform for statement
     */
    transformForStatement(node) {
      // Delphi for loops: for i := start to end do
      // Convert C-style for to Delphi for

      let varName = 'I';
      let startValue = DelphiLiteral.Integer(0);
      let endValue = null;

      // Extract init
      if (node.init && node.init.type === 'VariableDeclaration') {
        const decl = node.init.declarations[0];
        varName = this.toCamelCase(decl.id.name);
        if (decl.init) {
          startValue = this.transformExpression(decl.init);
        }
      }

      // Extract end condition
      if (node.test && node.test.type === 'BinaryExpression') {
        endValue = this.transformExpression(node.test.right);
      }

      const forLoop = new DelphiFor(
        varName,
        startValue,
        endValue || DelphiLiteral.Integer(10),
        false
      );

      forLoop.body = this.transformStatement(node.body) || new DelphiBlock();

      return forLoop;
    }

    /**
     * Transform for-of statement
     */
    transformForOfStatement(node) {
      let varName = 'Item';
      if (node.left.type === 'VariableDeclaration') {
        const decl = node.left.declarations[0];
        if (decl && decl.id) {
          varName = this.toCamelCase(decl.id.name);
        }
      } else if (node.left.type === 'Identifier') {
        varName = this.toCamelCase(node.left.name);
      }

      const collection = this.transformExpression(node.right);
      const forIn = new DelphiForIn(varName, collection);
      forIn.body = this.transformStatement(node.body) || new DelphiBlock();

      return forIn;
    }

    /**
     * Transform for-in statement
     */
    transformForInStatement(node) {
      // Similar to for-of
      return this.transformForOfStatement(node);
    }

    /**
     * Transform while statement
     */
    transformWhileStatement(node) {
      const condition = this.transformExpression(node.test);
      const whileLoop = new DelphiWhile(condition);
      whileLoop.body = this.transformStatement(node.body) || new DelphiBlock();

      return whileLoop;
    }

    /**
     * Transform do-while statement
     */
    transformDoWhileStatement(node) {
      const condition = this.transformExpression(node.test);
      const repeatLoop = new DelphiRepeat(condition);
      repeatLoop.body = this.transformStatement(node.body) || new DelphiBlock();

      return repeatLoop;
    }

    /**
     * Transform switch statement to case
     */
    transformSwitchStatement(node) {
      const expression = this.transformExpression(node.discriminant);
      const caseStmt = new DelphiCase(expression);

      for (const caseNode of node.cases) {
        if (caseNode.test) {
          const value = this.transformExpression(caseNode.test);
          const body = new DelphiBlock();

          for (const stmt of caseNode.consequent) {
            const delphiStmt = this.transformStatement(stmt);
            if (delphiStmt) {
              if (Array.isArray(delphiStmt)) {
                body.statements.push(...delphiStmt);
              } else {
                body.statements.push(delphiStmt);
              }
            }
          }

          const branch = new DelphiCaseBranch([value], body);
          caseStmt.branches.push(branch);
        } else {
          // Default case
          const elseBody = new DelphiBlock();
          for (const stmt of caseNode.consequent) {
            const delphiStmt = this.transformStatement(stmt);
            if (delphiStmt) {
              if (Array.isArray(delphiStmt)) {
                elseBody.statements.push(...delphiStmt);
              } else {
                elseBody.statements.push(delphiStmt);
              }
            }
          }
          caseStmt.elseBranch = elseBody;
        }
      }

      return caseStmt;
    }

    /**
     * Transform try statement
     */
    transformTryStatement(node) {
      const tryStmt = new DelphiTry();

      tryStmt.tryBlock = this.transformStatement(node.block) || new DelphiBlock();

      if (node.handler) {
        const exceptBlock = new DelphiExceptBlock();
        const exceptionType = node.handler.param ?
          this.toPascalCase(node.handler.param.name) : 'Exception';
        const variableName = node.handler.param ? 'E' : null;

        const handler = new DelphiExceptionHandler(exceptionType, variableName);
        handler.body = this.transformStatement(node.handler.body) || new DelphiBlock();

        exceptBlock.handlers.push(handler);
        tryStmt.exceptBlock = exceptBlock;
      }

      if (node.finalizer) {
        tryStmt.finallyBlock = this.transformStatement(node.finalizer) || new DelphiBlock();
      }

      return tryStmt;
    }

    /**
     * Transform throw statement
     */
    transformThrowStatement(node) {
      const exception = node.argument ? this.transformExpression(node.argument) : null;
      return new DelphiRaise(exception);
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
          return new DelphiIdentifier('Self');

        case 'Super':
          return new DelphiIdentifier('inherited');

        case 'ConditionalExpression':
          return this.transformConditionalExpression(node);

        case 'ArrowFunctionExpression':
        case 'FunctionExpression':
          return this.transformFunctionExpression(node);

        case 'SequenceExpression':
          // Return last expression
          if (node.expressions && node.expressions.length > 0) {
            return this.transformExpression(node.expressions[node.expressions.length - 1]);
          }
          return null;

        case 'SpreadElement':
          return this.transformExpression(node.argument);

        case 'TemplateLiteral':
          return this.transformTemplateLiteral(node);

        case 'ObjectPattern':
          // Object destructuring - Delphi doesn't support this directly
          // Return a comment placeholder
          return new DelphiIdentifier('{ Object destructuring not supported in Delphi }');

        default:
          return null;
      }
    }

    /**
     * Transform identifier
     */
    transformIdentifier(node) {
      let name = node.name;

      // Map JavaScript keywords to Delphi equivalents
      if (name === 'undefined' || name === 'null') return DelphiLiteral.Nil();
      if (name === 'true') return DelphiLiteral.Boolean(true);
      if (name === 'false') return DelphiLiteral.Boolean(false);

      // Convert to PascalCase for Delphi
      return new DelphiIdentifier(this.toCamelCase(name));
    }

    /**
     * Transform literal
     */
    transformLiteral(node) {
      if (typeof node.value === 'number') {
        if (Number.isInteger(node.value)) {
          return DelphiLiteral.Integer(node.value);
        }
        return DelphiLiteral.Float(node.value);
      }

      if (typeof node.value === 'string') {
        return DelphiLiteral.String(node.value);
      }

      if (typeof node.value === 'boolean') {
        return DelphiLiteral.Boolean(node.value);
      }

      if (node.value === null) {
        return DelphiLiteral.Nil();
      }

      return DelphiLiteral.Integer(0);
    }

    /**
     * Transform binary expression
     */
    transformBinaryExpression(node) {
      let left = this.transformExpression(node.left);
      let right = this.transformExpression(node.right);

      // Map operators
      let operator = node.operator;
      if (operator === '===') operator = '=';
      if (operator === '!==') operator = '<>';
      if (operator === '==') operator = '=';
      if (operator === '!=') operator = '<>';
      if (operator === '&&') operator = 'and';
      if (operator === '||') operator = 'or';
      if (operator === '/') operator = 'div'; // Integer division in Pascal
      if (operator === '%') operator = 'mod';
      if (operator === '>>') operator = 'shr';
      if (operator === '<<') operator = 'shl';
      if (operator === '>>>') operator = 'shr'; // Unsigned shift

      return new DelphiBinaryExpression(left, operator, right);
    }

    /**
     * Transform unary expression
     */
    transformUnaryExpression(node) {
      const operand = this.transformExpression(node.argument);

      let operator = node.operator;
      if (operator === '!') operator = 'not';
      if (operator === '~') operator = 'not'; // Bitwise not

      return new DelphiUnaryExpression(operator, operand);
    }

    /**
     * Transform assignment expression
     */
    transformAssignmentExpression(node) {
      const left = this.transformExpression(node.left);
      let right = this.transformExpression(node.right);

      // Handle compound assignments
      if (node.operator !== '=') {
        const op = node.operator.slice(0, -1); // Remove '='
        let delphiOp = op;
        if (op === '/') delphiOp = 'div';
        if (op === '%') delphiOp = 'mod';
        if (op === '>>') delphiOp = 'shr';
        if (op === '<<') delphiOp = 'shl';

        right = new DelphiBinaryExpression(left, delphiOp, right);
      }

      return new DelphiAssignment(left, right);
    }

    /**
     * Transform update expression (++, --)
     */
    transformUpdateExpression(node) {
      const operand = this.transformExpression(node.argument);
      const value = DelphiLiteral.Integer(1);
      const op = node.operator === '++' ? '+' : '-';

      const newValue = new DelphiBinaryExpression(operand, op, value);
      return new DelphiAssignment(operand, newValue);
    }

    /**
     * Transform member expression
     */
    transformMemberExpression(node) {
      const object = this.transformExpression(node.object);

      if (node.computed) {
        // Array indexing
        const index = this.transformExpression(node.property);
        return new DelphiArrayAccess(object, index);
      } else {
        // Field access
        const field = node.property.name || node.property.value;

        // Handle special properties
        if (field === 'length') {
          return new DelphiCall(new DelphiIdentifier('Length'), [object]);
        }

        return new DelphiFieldAccess(object, this.toCamelCase(field));
      }
    }

    /**
     * Transform call expression
     */
    transformCallExpression(node) {
      // Handle OpCodes calls
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'OpCodes') {
        return this.transformOpCodesCall(node);
      }

      // Handle method calls
      if (node.callee.type === 'MemberExpression') {
        const object = this.transformExpression(node.callee.object);
        const method = node.callee.property.name || node.callee.property.value;
        const args = node.arguments.map(arg => this.transformExpression(arg));

        const methodCall = new DelphiFieldAccess(object, this.toPascalCase(method));
        return new DelphiCall(methodCall, args);
      }

      // Regular function call
      const callee = this.transformExpression(node.callee);
      const args = node.arguments.map(arg => this.transformExpression(arg));

      return new DelphiCall(callee, args);
    }

    /**
     * Transform OpCodes calls to Delphi equivalents
     */
    transformOpCodesCall(node) {
      const methodName = node.callee.property.name;
      const args = node.arguments.map(arg => this.transformExpression(arg));

      // Map OpCodes methods to Delphi equivalents
      const opCodesMap = {
        'RotL32': 'RolDWord',
        'RotR32': 'RorDWord',
        'RotL8': 'RolByte',
        'RotR8': 'RorByte',
        'Pack32LE': 'PackLE',
        'Pack32BE': 'PackBE',
        'Unpack32LE': 'UnpackLE',
        'Unpack32BE': 'UnpackBE',
        'XorArrays': 'XorBytes',
        'ClearArray': 'FillChar',
        'Hex8ToBytes': 'HexToBytes',
        'BytesToHex8': 'BytesToHex',
        'AnsiToBytes': 'AnsiStringToBytes',
        'BytesToAnsi': 'BytesToAnsiString'
      };

      const delphiFunc = opCodesMap[methodName] || methodName;
      return new DelphiCall(new DelphiIdentifier(delphiFunc), args);
    }

    /**
     * Transform array expression
     */
    transformArrayExpression(node) {
      const elements = node.elements.map(elem => this.transformExpression(elem));
      return new DelphiArrayLiteral(elements);
    }

    /**
     * Transform object expression
     */
    transformObjectExpression(node) {
      // For now, return nil - would need record literal syntax
      return DelphiLiteral.Nil();
    }

    /**
     * Transform new expression
     */
    transformNewExpression(node) {
      if (node.callee.type === 'Identifier') {
        const typeName = this.toPascalCase(node.callee.name);
        const args = node.arguments.map(arg => this.transformExpression(arg));

        // Handle TypedArrays
        const typedArrayMap = {
          'Uint8Array': 'TBytes',
          'Uint16Array': 'array of Word',
          'Uint32Array': 'array of Cardinal',
          'Int8Array': 'array of ShortInt',
          'Int16Array': 'array of SmallInt',
          'Int32Array': 'array of Integer'
        };

        if (typedArrayMap[node.callee.name]) {
          // SetLength(arr, size)
          return new DelphiCall(
            new DelphiIdentifier('SetLength'),
            args
          );
        }

        // Regular constructor call
        return new DelphiCall(
          new DelphiFieldAccess(new DelphiIdentifier(typeName), 'Create'),
          args
        );
      }

      return DelphiLiteral.Nil();
    }

    /**
     * Transform conditional expression (ternary)
     */
    transformConditionalExpression(node) {
      // Delphi doesn't have ternary, use if-then-else expression (Delphi 11+)
      // For older Delphi, would need to expand to if statement
      const condition = this.transformExpression(node.test);
      const thenExpr = this.transformExpression(node.consequent);
      const elseExpr = this.transformExpression(node.alternate);

      // Return as inline if (modern Delphi)
      // if condition then thenExpr else elseExpr
      return new DelphiCall(
        new DelphiIdentifier('IfThen'),
        [condition, thenExpr, elseExpr]
      );
    }

    /**
     * Transform function expression (anonymous method in Delphi)
     */
    transformFunctionExpression(node) {
      // Delphi anonymous methods: procedure(x: Integer) begin ... end
      // For now, return nil - would need full anonymous method support
      return DelphiLiteral.Nil();
    }

    /**
     * Transform template literal
     */
    transformTemplateLiteral(node) {
      // Convert to Format() call
      let formatStr = '';
      const args = [];

      for (let i = 0; i < node.quasis.length; i++) {
        formatStr += node.quasis[i].value.raw;
        if (i < node.expressions.length) {
          formatStr += '%s';
          args.push(this.transformExpression(node.expressions[i]));
        }
      }

      return new DelphiCall(
        new DelphiIdentifier('Format'),
        [DelphiLiteral.String(formatStr), new DelphiArrayLiteral(args)]
      );
    }
  }

  // Export
  const exports = { DelphiTransformer };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.DelphiTransformer = DelphiTransformer;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
