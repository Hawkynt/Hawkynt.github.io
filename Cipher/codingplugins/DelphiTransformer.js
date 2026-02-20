/**
 * DelphiTransformer.js - IL AST to Delphi AST Transformer
 * Converts IL AST (type-inferred, language-agnostic) to Delphi AST
 * (c)2006-2025 Hawkynt
 *
 * Full Pipeline:
 *   JS Source → Parser → JS AST → IL Transformer → IL AST → Language Transformer → Language AST → Language Emitter → Language Source
 *
 * This transformer handles: IL AST → Delphi AST
 *
 * IL AST characteristics:
 *   - Type-inferred (no untyped nodes)
 *   - Language-agnostic (no JS-specific constructs like UMD, IIFE, Math.*, Object.*, etc.)
 *   - Global options already applied
 *
 * Language options (applied here and in emitter):
 *   - variant: 'DELPHI' | 'FPC' (Free Pascal) | 'LAZARUS'
 *   - useClasses: boolean (generate class vs record types)
 *   - useProperties: boolean (generate properties with getters/setters)
 *   - useSets: boolean (use set types where appropriate)
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
      // Handle both array body and object with body property
      const statements = Array.isArray(node.body) ? node.body :
                         (node.body?.body && Array.isArray(node.body.body)) ? node.body.body : [];
      return statements.map(stmt => this.transformStatement(stmt));
    }

    transformClassExpression(node) {
      // ClassExpression -> Delphi class type
      const className = node.id?.name || 'TAnonymousClass';
      const classDecl = new DelphiClass(className);

      if (node.superClass) {
        classDecl.parentClass = this.transformExpression(node.superClass);
      }

      if (node.body?.body) {
        for (const member of node.body.body) {
          const transformed = this.transformClassMember(member);
          if (transformed)
            classDecl.members.push(transformed);
        }
      }

      return classDecl;
    }

    transformYieldExpression(node) {
      // Delphi doesn't have yield - return the argument value directly
      return node.argument ? this.transformExpression(node.argument) : DelphiLiteral.Nil();
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

        // IL AST node types from type-aware-transpiler
        case 'ThisPropertyAccess':
          // Self.Property in Delphi - convert to PascalCase
          return new DelphiFieldAccess(new DelphiIdentifier('Self'), this.toPascalCase(node.property));

        case 'ThisMethodCall':
          // Self.Method(args) in Delphi
          {
            const args = (node.arguments || []).map(a => this.transformExpression(a));
            const methodAccess = new DelphiFieldAccess(new DelphiIdentifier('Self'), this.toPascalCase(node.method));
            return new DelphiCall(methodAccess, args);
          }

        case 'ParentConstructorCall':
          // inherited Create in Delphi
          {
            const args = (node.arguments || []).map(a => this.transformExpression(a));
            return new DelphiCall(new DelphiIdentifier('inherited Create'), args);
          }

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

        case 'StaticBlock':
          return this.transformStaticBlock(node);

        case 'ChainExpression':
          // Optional chaining a?.b - Delphi doesn't have this
          return this.transformExpression(node.expression);

        case 'ClassExpression':
          // Anonymous class expression
          return this.transformClassExpression(node);

        case 'YieldExpression':
          // yield - Delphi doesn't have generators
          return this.transformYieldExpression(node);

        case 'PrivateIdentifier':
          // #field -> Delphi private field with F prefix convention
          return new DelphiIdentifier('F' + this.toPascalCase(node.name));

        // IL AST node types for cryptographic operations
        case 'PackBytes':
          // Pack bytes to integer value - Pack32BE(b0, b1, b2, b3) etc.
          {
            const endian = node.endian || 'big';
            const bits = node.bits || 32;
            const funcName = `Pack${bits}${endian === 'big' ? 'BE' : 'LE'}`;
            const args = (node.arguments || node.bytes || []).map(a => this.transformExpression(a));
            return new DelphiCall(new DelphiIdentifier(funcName), args);
          }

        case 'UnpackBytes':
          // Unpack integer to bytes - Unpack32BE(value) etc.
          {
            const endian = node.endian || 'big';
            const bits = node.bits || 32;
            const funcName = `Unpack${bits}${endian === 'big' ? 'BE' : 'LE'}`;
            // Check multiple possible locations for the value
            const value = node.value ? this.transformExpression(node.value) :
                         node.argument ? this.transformExpression(node.argument) :
                         node.arguments?.[0] ? this.transformExpression(node.arguments[0]) : null;
            return new DelphiCall(new DelphiIdentifier(funcName), value ? [value] : []);
          }

        case 'RotateLeft':
          // Bit rotation left - RotL32(value, amount) etc.
          {
            const bits = node.bits || 32;
            const funcName = `RotL${bits}`;
            const value = this.transformExpression(node.value || node.arguments?.[0]);
            const amount = this.transformExpression(node.amount || node.arguments?.[1]);
            return new DelphiCall(new DelphiIdentifier(funcName), [value, amount]);
          }

        case 'RotateRight':
          // Bit rotation right - RotR32(value, amount) etc.
          {
            const bits = node.bits || 32;
            const funcName = `RotR${bits}`;
            const value = this.transformExpression(node.value || node.arguments?.[0]);
            const amount = this.transformExpression(node.amount || node.arguments?.[1]);
            return new DelphiCall(new DelphiIdentifier(funcName), [value, amount]);
          }

        case 'HexDecode':
          // Convert hex string to bytes - HexToBytes(hexStr)
          {
            const args = (node.arguments || []).map(a => this.transformExpression(a));
            return new DelphiCall(new DelphiIdentifier('HexToBytes'), args);
          }

        case 'HexEncode':
          // Convert bytes to hex string - BytesToHex(bytes)
          {
            const args = (node.arguments || []).map(a => this.transformExpression(a));
            return new DelphiCall(new DelphiIdentifier('BytesToHex'), args);
          }

        case 'StringToBytes':
          // Convert string to bytes - StringToBytes(str)
          {
            const args = (node.arguments || []).map(a => this.transformExpression(a));
            return new DelphiCall(new DelphiIdentifier('AnsiStringToBytes'), args);
          }

        case 'BytesToString':
          // Convert bytes to string - BytesToAnsiString(bytes)
          {
            const args = (node.arguments || []).map(a => this.transformExpression(a));
            return new DelphiCall(new DelphiIdentifier('BytesToAnsiString'), args);
          }

        case 'ArrayXor':
          // XOR two arrays - XorArrays(arr1, arr2)
          {
            const args = (node.arguments || []).map(a => this.transformExpression(a));
            return new DelphiCall(new DelphiIdentifier('XorArrays'), args);
          }

        case 'ArrayClear':
          // Clear array contents - ClearArray(arr)
          {
            const args = (node.arguments || []).map(a => this.transformExpression(a));
            return new DelphiCall(new DelphiIdentifier('ClearArray'), args);
          }

        case 'ArrayLength':
          // Get array length - Length(arr)
          {
            const arr = this.transformExpression(node.argument || node.array || node.arguments?.[0]);
            return new DelphiCall(new DelphiIdentifier('Length'), [arr]);
          }

        case 'ArrayPush':
          // Append to array - requires SetLength + assignment
          {
            const arr = this.transformExpression(node.array || node.arguments?.[0]);
            const value = this.transformExpression(node.value || node.arguments?.[1]);
            // Use helper function AppendToArray
            return new DelphiCall(new DelphiIdentifier('AppendToArray'), [arr, value]);
          }

        case 'ArraySlice':
          // Slice array - Copy(arr, start, length)
          {
            const arr = this.transformExpression(node.array || node.arguments?.[0]);
            const start = this.transformExpression(node.start || node.arguments?.[1] || { type: 'Literal', value: 0 });
            const end = node.end || node.arguments?.[2];
            if (end) {
              const endExpr = this.transformExpression(end);
              // Copy from start to end-start length
              return new DelphiCall(new DelphiIdentifier('Copy'), [arr, start, new DelphiBinaryExpression('-', endExpr, start)]);
            }
            return new DelphiCall(new DelphiIdentifier('Copy'), [arr, start]);
          }

        case 'Cast':
          // Type cast - use appropriate Delphi type cast
          {
            const value = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
            const targetType = node.targetType || 'Cardinal';
            let delphiType = 'Cardinal';
            if (targetType === 'uint32' || targetType === 'dword') delphiType = 'Cardinal';
            else if (targetType === 'uint8' || targetType === 'byte') delphiType = 'Byte';
            else if (targetType === 'int32') delphiType = 'Integer';
            else if (targetType === 'uint16') delphiType = 'Word';
            else if (targetType === 'int16') delphiType = 'SmallInt';
            else if (targetType === 'uint64') delphiType = 'UInt64';
            else if (targetType === 'int64') delphiType = 'Int64';
            return new DelphiCall(new DelphiIdentifier(delphiType), [value]);
          }

        // IL AST StringInterpolation - `Hello ${name}` -> 'Hello ' + name
        case 'StringInterpolation': {
          const parts = [];
          if (node.parts) {
            for (const part of node.parts) {
              if (part.type === 'StringPart' || part.ilNodeType === 'StringPart') {
                if (part.value)
                  parts.push(DelphiLiteral.String(part.value));
              } else if (part.type === 'ExpressionPart' || part.ilNodeType === 'ExpressionPart') {
                parts.push(this.transformExpression(part.expression));
              }
            }
          }
          if (parts.length === 0) return DelphiLiteral.String('');
          if (parts.length === 1) return parts[0];
          return parts.reduce((acc, part) => new DelphiBinaryExpression('+', acc, part));
        }

        // IL AST ObjectLiteral - {key: value} -> nil (Delphi needs explicit types)
        case 'ObjectLiteral': {
          return DelphiLiteral.Nil();
        }

        // IL AST StringFromCharCodes - String.fromCharCode(65) -> Chr(65)
        case 'StringFromCharCodes': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          if (args.length === 0)
            return DelphiLiteral.String('');
          if (args.length === 1)
            return new DelphiCall(new DelphiIdentifier('Chr'), args);
          // Multiple: Chr(c1) + Chr(c2) + ...
          const chrCalls = args.map(a => new DelphiCall(new DelphiIdentifier('Chr'), [a]));
          return chrCalls.reduce((acc, call) => new DelphiBinaryExpression('+', acc, call));
        }

        // IL AST IsArrayCheck - Array.isArray(x) -> Length(x) > 0
        case 'IsArrayCheck': {
          const value = this.transformExpression(node.value);
          return new DelphiBinaryExpression('>', new DelphiCall(new DelphiIdentifier('Length'), [value]), DelphiLiteral.Integer(0));
        }

        // IL AST ArrowFunction - not supported in Delphi
        case 'ArrowFunction': {
          return new DelphiIdentifier('{ anonymous function }');
        }

        // IL AST TypeOfExpression - typeof x -> ClassName (for objects)
        case 'TypeOfExpression': {
          const value = this.transformExpression(node.value);
          return new DelphiCall(new DelphiIdentifier('ClassName'), [value]);
        }

        // IL AST Power - x ** y -> Power(x, y)
        case 'Power': {
          const left = this.transformExpression(node.left);
          const right = this.transformExpression(node.right);
          return new DelphiCall(new DelphiIdentifier('Power'), [left, right]);
        }

        // IL AST ObjectFreeze - Object.freeze(x) -> just return x
        case 'ObjectFreeze': {
          return this.transformExpression(node.value);
        }

        case 'Floor':
          return new DelphiCall(new DelphiIdentifier('Floor'), [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Ceil':
          return new DelphiCall(new DelphiIdentifier('Ceil'), [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Abs':
          return new DelphiCall(new DelphiIdentifier('Abs'), [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Min':
          return new DelphiCall(new DelphiIdentifier('Min'), (node.values || node.arguments || []).map(v => this.transformExpression(v)));

        case 'Max':
          return new DelphiCall(new DelphiIdentifier('Max'), (node.values || node.arguments || []).map(v => this.transformExpression(v)));

        case 'Pow':
          return new DelphiCall(new DelphiIdentifier('Power'), [
            this.transformExpression(node.base || node.arguments?.[0]),
            this.transformExpression(node.exponent || node.arguments?.[1])
          ]);

        case 'Sqrt':
          return new DelphiCall(new DelphiIdentifier('Sqrt'), [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Cbrt':
          // Delphi: Power(arg, 1/3)
          return new DelphiCall(new DelphiIdentifier('Power'), [
            this.transformExpression(node.arguments?.[0] || node.value),
            new DelphiBinaryExpression('/', DelphiLiteral.Integer(1), DelphiLiteral.Integer(3))
          ]);

        case 'Log':
          return new DelphiCall(new DelphiIdentifier('Ln'), [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Log2':
          return new DelphiCall(new DelphiIdentifier('Log2'), [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Log10':
          return new DelphiCall(new DelphiIdentifier('Log10'), [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Exp':
          return new DelphiCall(new DelphiIdentifier('Exp'), [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Round':
          return new DelphiCall(new DelphiIdentifier('Round'), [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Trunc':
          return new DelphiCall(new DelphiIdentifier('Trunc'), [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Sign':
          return new DelphiCall(new DelphiIdentifier('Sign'), [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Sin':
          return new DelphiCall(new DelphiIdentifier('Sin'), [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Cos':
          return new DelphiCall(new DelphiIdentifier('Cos'), [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Tan':
          return new DelphiCall(new DelphiIdentifier('Tan'), [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Asin':
          return new DelphiCall(new DelphiIdentifier('ArcSin'), [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Acos':
          return new DelphiCall(new DelphiIdentifier('ArcCos'), [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Atan':
          return new DelphiCall(new DelphiIdentifier('ArcTan'), [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Atan2': {
          const y = this.transformExpression(node.arguments?.[0] || node.y);
          const x = this.transformExpression(node.arguments?.[1] || node.x);
          return new DelphiCall(new DelphiIdentifier('ArcTan2'), [y, x]);
        }

        case 'Sinh':
          return new DelphiCall(new DelphiIdentifier('Sinh'), [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Cosh':
          return new DelphiCall(new DelphiIdentifier('Cosh'), [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Tanh':
          return new DelphiCall(new DelphiIdentifier('Tanh'), [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Hypot':
          return new DelphiCall(new DelphiIdentifier('Hypot'), (node.arguments || []).map(a => this.transformExpression(a)));

        case 'Fround':
          // Delphi: Single(arg) - cast to single-precision float
          return new DelphiCall(new DelphiIdentifier('Single'), [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'MathCall': {
          const method = node.method;
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          if (method === 'imul') {
            if (args.length >= 2)
              return new DelphiCall(new DelphiIdentifier('Integer'), [new DelphiBinaryExpression('*', args[0], args[1])]);
          }
          // Map known methods to Delphi equivalents
          const methodMap = {
            'floor': 'Floor', 'ceil': 'Ceil', 'abs': 'Abs',
            'min': 'Min', 'max': 'Max', 'pow': 'Power',
            'sqrt': 'Sqrt', 'log': 'Ln', 'log2': 'Log2', 'log10': 'Log10',
            'exp': 'Exp', 'round': 'Round', 'trunc': 'Trunc',
            'sign': 'Sign', 'sin': 'Sin', 'cos': 'Cos', 'tan': 'Tan',
            'random': 'Random'
          };
          const delphiMethod = methodMap[method] || this.toPascalCase(method);
          return new DelphiCall(new DelphiIdentifier(delphiMethod), args);
        }

        case 'MathConstant': {
          switch (node.name) {
            case 'PI': return new DelphiIdentifier('Pi');
            case 'E': return new DelphiCall(new DelphiIdentifier('Exp'), [DelphiLiteral.Integer(1)]);
            case 'LN2': return new DelphiCall(new DelphiIdentifier('Ln'), [DelphiLiteral.Integer(2)]);
            case 'LN10': return new DelphiCall(new DelphiIdentifier('Ln'), [DelphiLiteral.Integer(10)]);
            case 'LOG2E': return new DelphiCall(new DelphiIdentifier('Log2'), [new DelphiCall(new DelphiIdentifier('Exp'), [DelphiLiteral.Integer(1)])]);
            case 'LOG10E': return new DelphiCall(new DelphiIdentifier('Log10'), [new DelphiCall(new DelphiIdentifier('Exp'), [DelphiLiteral.Integer(1)])]);
            case 'SQRT2': return new DelphiCall(new DelphiIdentifier('Sqrt'), [DelphiLiteral.Integer(2)]);
            case 'SQRT1_2': return new DelphiCall(new DelphiIdentifier('Sqrt'), [DelphiLiteral.Float(0.5)]);
            default: return DelphiLiteral.Float(node.value);
          }
        }

        case 'NumberConstant': {
          switch (node.name) {
            case 'MAX_SAFE_INTEGER': return new DelphiIdentifier('MaxLongInt');
            case 'MIN_SAFE_INTEGER': return new DelphiUnaryExpression('-', new DelphiIdentifier('MaxLongInt'));
            case 'MAX_VALUE': return new DelphiIdentifier('MaxDouble');
            case 'MIN_VALUE': return new DelphiIdentifier('MinDouble');
            case 'POSITIVE_INFINITY': return new DelphiIdentifier('Infinity');
            case 'NEGATIVE_INFINITY': return new DelphiIdentifier('NegInfinity');
            case 'NaN': return new DelphiIdentifier('NaN');
            case 'EPSILON': return DelphiLiteral.Float(5e-324);
            default: return DelphiLiteral.Float(node.value);
          }
        }

        case 'InstanceOfCheck': {
          const value = this.transformExpression(node.value);
          const className = typeof node.className === 'string' ? new DelphiIdentifier(node.className) : this.transformExpression(node.className);
          return new DelphiBinaryExpression('is', value, className);
        }

        // ========================[ Array Operations ]========================

        case 'ArrayAppend': {
          // IL AST: array.push(value) -> SetLength(arr, Length(arr) + 1); arr[High(arr)] := value
          // For expression context, use AppendToArray helper
          const arr = this.transformExpression(node.array);
          const value = this.transformExpression(node.value);
          return new DelphiCall(new DelphiIdentifier('AppendToArray'), [arr, value]);
        }

        case 'ArrayConcat': {
          // IL AST: arr1.concat(arr2, ...) -> Concat(arr1, arr2)
          const arr = this.transformExpression(node.array);
          let result = arr;
          for (const other of (node.arrays || [])) {
            const otherExpr = this.transformExpression(other);
            result = new DelphiCall(new DelphiIdentifier('Concat'), [result, otherExpr]);
          }
          return result;
        }

        case 'ArrayEvery': {
          // IL AST: array.every(callback) -> AllMatch(arr, callback)
          // Delphi has no lambdas in older versions; use helper
          const arr = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : DelphiLiteral.Nil();
          return new DelphiCall(new DelphiIdentifier('AllMatch'), [arr, callback]);
        }

        case 'ArrayFilter': {
          // IL AST: array.filter(callback) -> FilterArray(arr, callback)
          const arr = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : DelphiLiteral.Nil();
          return new DelphiCall(new DelphiIdentifier('FilterArray'), [arr, callback]);
        }

        case 'ArrayFind': {
          // IL AST: array.find(callback) -> FindInArray(arr, callback)
          const arr = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : DelphiLiteral.Nil();
          return new DelphiCall(new DelphiIdentifier('FindInArray'), [arr, callback]);
        }

        case 'ArrayFindIndex': {
          // IL AST: array.findIndex(callback) -> FindIndexInArray(arr, callback)
          const arr = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : DelphiLiteral.Nil();
          return new DelphiCall(new DelphiIdentifier('FindIndexInArray'), [arr, callback]);
        }

        case 'ArrayForEach': {
          // IL AST: array.forEach(callback) -> for item in arr do callback(item)
          const arr = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : DelphiLiteral.Nil();
          return new DelphiCall(new DelphiIdentifier('ForEachInArray'), [arr, callback]);
        }

        case 'ArrayFrom': {
          // IL AST: Array.from(iterable) -> Copy(arr) or array assignment
          const iterable = this.transformExpression(node.iterable || node.argument || node.arguments?.[0]);
          if (node.mapFunction) {
            const mapFn = this.transformExpression(node.mapFunction);
            return new DelphiCall(new DelphiIdentifier('MapArray'), [iterable, mapFn]);
          }
          return new DelphiCall(new DelphiIdentifier('Copy'), [iterable]);
        }

        case 'ArrayIncludes': {
          // IL AST: array.includes(value) -> ArrayContains(arr, value)
          const arr = this.transformExpression(node.array);
          const value = this.transformExpression(node.value);
          return new DelphiCall(new DelphiIdentifier('ArrayContains'), [arr, value]);
        }

        case 'ArrayIndexOf': {
          // IL AST: array.indexOf(value) -> IndexOfInArray(arr, value)
          const arr = this.transformExpression(node.array);
          const value = this.transformExpression(node.value);
          const args = [arr, value];
          if (node.start)
            args.push(this.transformExpression(node.start));
          return new DelphiCall(new DelphiIdentifier('IndexOfInArray'), args);
        }

        case 'ArrayJoin': {
          // IL AST: array.join(separator) -> StringJoin(separator, arr)
          const arr = this.transformExpression(node.array);
          const separator = node.separator
            ? this.transformExpression(node.separator)
            : DelphiLiteral.String(',');
          return new DelphiCall(new DelphiIdentifier('StringJoin'), [separator, arr]);
        }

        case 'ArrayMap': {
          // IL AST: array.map(callback) -> MapArray(arr, callback)
          const arr = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : DelphiLiteral.Nil();
          return new DelphiCall(new DelphiIdentifier('MapArray'), [arr, callback]);
        }

        case 'ArrayPop': {
          // IL AST: array.pop() -> get last + SetLength(arr, Length(arr) - 1)
          const arr = this.transformExpression(node.array);
          return new DelphiCall(new DelphiIdentifier('ArrayPopLast'), [arr]);
        }

        case 'ArrayReduce': {
          // IL AST: array.reduce(callback, initial) -> ReduceArray(arr, callback, initial)
          const arr = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : DelphiLiteral.Nil();
          const args = [arr, callback];
          if (node.initialValue)
            args.push(this.transformExpression(node.initialValue));
          return new DelphiCall(new DelphiIdentifier('ReduceArray'), args);
        }

        case 'ArrayReverse': {
          // IL AST: array.reverse() -> ReverseArray(arr)
          const arr = this.transformExpression(node.array);
          return new DelphiCall(new DelphiIdentifier('ReverseArray'), [arr]);
        }

        case 'ArrayShift': {
          // IL AST: array.shift() -> get first + shift elements + SetLength
          const arr = this.transformExpression(node.array);
          return new DelphiCall(new DelphiIdentifier('ArrayShiftFirst'), [arr]);
        }

        case 'ArraySome': {
          // IL AST: array.some(callback) -> AnyMatch(arr, callback)
          const arr = this.transformExpression(node.array);
          const callback = node.callback ? this.transformExpression(node.callback) : DelphiLiteral.Nil();
          return new DelphiCall(new DelphiIdentifier('AnyMatch'), [arr, callback]);
        }

        case 'ArraySort': {
          // IL AST: array.sort(compareFn) -> TArray.Sort<T>(arr) or SortArray(arr, compareFn)
          const arr = this.transformExpression(node.array);
          if (node.compareFn) {
            const compareFn = this.transformExpression(node.compareFn);
            return new DelphiCall(new DelphiIdentifier('SortArray'), [arr, compareFn]);
          }
          return new DelphiCall(new DelphiFieldAccess(new DelphiIdentifier('TArray'), 'Sort'), [arr]);
        }

        case 'ArraySplice': {
          // IL AST: array.splice(start, deleteCount, items...) -> manual array manipulation
          const arr = this.transformExpression(node.array);
          const start = this.transformExpression(node.start);
          const deleteCount = node.deleteCount ? this.transformExpression(node.deleteCount) : DelphiLiteral.Integer(0);
          const args = [arr, start, deleteCount];
          if (node.items) {
            for (const item of node.items)
              args.push(this.transformExpression(item));
          }
          return new DelphiCall(new DelphiIdentifier('SpliceArray'), args);
        }

        case 'ArrayUnshift': {
          // IL AST: array.unshift(value) -> shift elements + insert at 0
          const arr = this.transformExpression(node.array);
          const value = node.value ? this.transformExpression(node.value) : DelphiLiteral.Nil();
          return new DelphiCall(new DelphiIdentifier('ArrayUnshiftFirst'), [arr, value]);
        }

        case 'CopyArray': {
          // IL AST: OpCodes.CopyArray(arr) -> Copy(arr)
          const arr = this.transformExpression(node.array || node.argument || node.arguments?.[0]);
          return new DelphiCall(new DelphiIdentifier('Copy'), [arr]);
        }

        case 'ArrayCreation': {
          // IL AST: new Array(size) -> SetLength(arr, size)
          const size = node.size ? this.transformExpression(node.size) : DelphiLiteral.Integer(0);
          return new DelphiCall(new DelphiIdentifier('SetLength'), [size]);
        }

        // ========================[ String Operations ]========================

        case 'StringCharAt': {
          // IL AST: string.charAt(index) -> str[index + 1] (Delphi is 1-based!)
          const str = this.transformExpression(node.string || node.value);
          const index = this.transformExpression(node.index);
          // Delphi strings are 1-based, so add 1 to 0-based index
          return new DelphiArrayAccess(str, new DelphiBinaryExpression(index, '+', DelphiLiteral.Integer(1)));
        }

        case 'StringCharCodeAt': {
          // IL AST: string.charCodeAt(index) -> Ord(str[index + 1]) (1-based!)
          const str = this.transformExpression(node.string || node.value);
          const index = this.transformExpression(node.index);
          const charAccess = new DelphiArrayAccess(str, new DelphiBinaryExpression(index, '+', DelphiLiteral.Integer(1)));
          return new DelphiCall(new DelphiIdentifier('Ord'), [charAccess]);
        }

        case 'StringEndsWith': {
          // IL AST: string.endsWith(suffix) -> str.EndsWith(suffix) or Copy comparison
          const str = this.transformExpression(node.string || node.value);
          const suffix = this.transformExpression(node.suffix || node.search);
          return new DelphiCall(new DelphiFieldAccess(str, 'EndsWith'), [suffix]);
        }

        case 'StringIncludes': {
          // IL AST: string.includes(search) -> Pos(search, str) > 0
          const str = this.transformExpression(node.string || node.value);
          const search = this.transformExpression(node.searchValue || node.search);
          return new DelphiBinaryExpression(
            new DelphiCall(new DelphiIdentifier('Pos'), [search, str]),
            '>',
            DelphiLiteral.Integer(0)
          );
        }

        case 'StringIndexOf': {
          // IL AST: string.indexOf(search) -> Pos(search, str) - 1 (convert to 0-based)
          const str = this.transformExpression(node.string || node.value);
          const search = this.transformExpression(node.searchValue || node.search);
          return new DelphiBinaryExpression(
            new DelphiCall(new DelphiIdentifier('Pos'), [search, str]),
            '-',
            DelphiLiteral.Integer(1)
          );
        }

        case 'StringRepeat': {
          // IL AST: string.repeat(count) -> StringOfChar or loop concatenation
          const str = this.transformExpression(node.string || node.value);
          const count = this.transformExpression(node.count);
          return new DelphiCall(new DelphiIdentifier('StringRepeat'), [str, count]);
        }

        case 'StringReplace': {
          // IL AST: string.replace(search, replace) -> StringReplace(str, old, new, [rfReplaceAll])
          const str = this.transformExpression(node.string || node.value);
          const search = this.transformExpression(node.searchValue || node.search);
          const replace = this.transformExpression(node.replaceValue || node.replacement);
          return new DelphiCall(new DelphiIdentifier('StringReplace'), [str, search, replace, new DelphiArrayLiteral([new DelphiIdentifier('rfReplaceAll')])]);
        }

        case 'StringSplit': {
          // IL AST: string.split(separator) -> str.Split([separator])
          const str = this.transformExpression(node.string || node.value);
          const separator = this.transformExpression(node.separator);
          return new DelphiCall(new DelphiFieldAccess(str, 'Split'), [new DelphiArrayLiteral([separator])]);
        }

        case 'StringStartsWith': {
          // IL AST: string.startsWith(prefix) -> str.StartsWith(prefix)
          const str = this.transformExpression(node.string || node.value);
          const prefix = this.transformExpression(node.prefix || node.search);
          return new DelphiCall(new DelphiFieldAccess(str, 'StartsWith'), [prefix]);
        }

        case 'StringSubstring': {
          // IL AST: string.substring(start, end) -> Copy(str, start + 1, end - start) (1-based!)
          const str = this.transformExpression(node.string || node.value);
          const start = this.transformExpression(node.start);
          if (node.end) {
            const end = this.transformExpression(node.end);
            // Copy(str, start + 1, end - start)
            return new DelphiCall(new DelphiIdentifier('Copy'), [
              str,
              new DelphiBinaryExpression(start, '+', DelphiLiteral.Integer(1)),
              new DelphiBinaryExpression(end, '-', start)
            ]);
          }
          // Copy(str, start + 1, MaxInt) - to end of string
          return new DelphiCall(new DelphiIdentifier('Copy'), [
            str,
            new DelphiBinaryExpression(start, '+', DelphiLiteral.Integer(1)),
            new DelphiIdentifier('MaxInt')
          ]);
        }

        case 'StringToLowerCase': {
          // IL AST: string.toLowerCase() -> LowerCase(str)
          const str = this.transformExpression(node.string || node.value);
          return new DelphiCall(new DelphiIdentifier('LowerCase'), [str]);
        }

        case 'StringToUpperCase': {
          // IL AST: string.toUpperCase() -> UpperCase(str)
          const str = this.transformExpression(node.string || node.value);
          return new DelphiCall(new DelphiIdentifier('UpperCase'), [str]);
        }

        case 'StringTrim': {
          // IL AST: string.trim() -> Trim(str)
          const str = this.transformExpression(node.string || node.value);
          return new DelphiCall(new DelphiIdentifier('Trim'), [str]);
        }

        case 'StringTransform': {
          // IL AST: string transform (toUpperCase/toLowerCase/trim etc.)
          const str = this.transformExpression(node.string || node.value);
          const methodMap = {
            'toUpperCase': 'UpperCase',
            'toLowerCase': 'LowerCase',
            'trim': 'Trim',
            'trimStart': 'TrimLeft',
            'trimEnd': 'TrimRight'
          };
          const delphiFunc = methodMap[node.method] || this.toPascalCase(node.method);
          return new DelphiCall(new DelphiIdentifier(delphiFunc), [str]);
        }

        case 'StringConcat': {
          // IL AST: string.concat(...others) -> str1 + str2 + ...
          const str = this.transformExpression(node.string || node.value);
          const args = (node.arguments || []).map(arg => this.transformExpression(arg));
          if (args.length === 0) return str;
          return args.reduce((acc, arg) => new DelphiBinaryExpression(acc, '+', arg), str);
        }

        // ========================[ Buffer/DataView Operations ]========================

        case 'BufferCreation': {
          // IL AST: new ArrayBuffer(size) or Buffer.alloc(size) -> SetLength(buf, size) for TBytes
          const size = this.transformExpression(node.size);
          return new DelphiCall(new DelphiIdentifier('SetLength'), [size]);
        }

        case 'DataViewCreation': {
          // IL AST: new DataView(buffer) -> use TBytes/pointer-based access
          const buffer = node.buffer ? this.transformExpression(node.buffer) : DelphiLiteral.Nil();
          // In Delphi, DataView is just the byte array itself with manual access
          return buffer;
        }

        case 'DataViewRead': {
          // IL AST: view.getUint32(offset, littleEndian) -> manual byte reading with bit shifting
          const view = this.transformExpression(node.view);
          const offset = this.transformExpression(node.offset);
          const method = node.method || 'getUint32';
          const littleEndian = node.littleEndian;

          let readFunc = 'ReadUInt32';
          if (method === 'getUint16') readFunc = 'ReadUInt16';
          else if (method === 'getUint8') readFunc = 'ReadByte';
          else if (method === 'getInt32') readFunc = 'ReadInt32';
          else if (method === 'getInt16') readFunc = 'ReadInt16';

          if (littleEndian !== false)
            readFunc += 'LE';
          else
            readFunc += 'BE';

          return new DelphiCall(new DelphiIdentifier(readFunc), [view, offset]);
        }

        case 'DataViewWrite': {
          // IL AST: view.setUint32(offset, value, littleEndian) -> manual byte writing
          const view = this.transformExpression(node.view);
          const offset = this.transformExpression(node.offset);
          const value = this.transformExpression(node.value);
          const method = node.method || 'setUint32';
          const littleEndian = node.littleEndian;

          let writeFunc = 'WriteUInt32';
          if (method === 'setUint16') writeFunc = 'WriteUInt16';
          else if (method === 'setUint8') writeFunc = 'WriteByte';
          else if (method === 'setInt32') writeFunc = 'WriteInt32';
          else if (method === 'setInt16') writeFunc = 'WriteInt16';

          if (littleEndian !== false)
            writeFunc += 'LE';
          else
            writeFunc += 'BE';

          return new DelphiCall(new DelphiIdentifier(writeFunc), [view, offset, value]);
        }

        case 'TypedArrayCreation': {
          // IL AST: new Uint8Array(size) -> SetLength(arr, size)
          const size = node.size ? this.transformExpression(node.size) : DelphiLiteral.Integer(0);
          return new DelphiCall(new DelphiIdentifier('SetLength'), [size]);
        }

        case 'TypedArraySet': {
          // IL AST: typedArray.set(source, offset) -> Move(source[0], dest[offset], Length(source))
          const arr = this.transformExpression(node.array);
          const source = node.source ? this.transformExpression(node.source) : DelphiLiteral.Nil();
          const offset = node.offset ? this.transformExpression(node.offset) : DelphiLiteral.Integer(0);
          return new DelphiCall(new DelphiIdentifier('Move'), [
            new DelphiArrayAccess(source, DelphiLiteral.Integer(0)),
            new DelphiArrayAccess(arr, offset),
            new DelphiCall(new DelphiIdentifier('Length'), [source])
          ]);
        }

        case 'TypedArraySubarray': {
          // IL AST: arr.subarray(start, end) -> Copy(arr, start, end - start)
          const arr = this.transformExpression(node.array);
          const start = this.transformExpression(node.start);
          if (node.end) {
            const end = this.transformExpression(node.end);
            return new DelphiCall(new DelphiIdentifier('Copy'), [arr, start, new DelphiBinaryExpression(end, '-', start)]);
          }
          return new DelphiCall(new DelphiIdentifier('Copy'), [arr, start]);
        }

        // ========================[ Map/Set Operations ]========================

        case 'MapCreation': {
          // IL AST: new Map() -> TDictionary<TKey, TValue>.Create
          return new DelphiCall(
            new DelphiFieldAccess(new DelphiIdentifier('TDictionary'), 'Create'),
            []
          );
        }

        case 'MapGet': {
          // IL AST: map.get(key) -> dict[key] or dict.TryGetValue(key, value)
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          return new DelphiArrayAccess(map, key);
        }

        case 'MapSet': {
          // IL AST: map.set(key, value) -> dict.AddOrSetValue(key, value)
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          const value = this.transformExpression(node.value);
          return new DelphiCall(new DelphiFieldAccess(map, 'AddOrSetValue'), [key, value]);
        }

        case 'MapHas': {
          // IL AST: map.has(key) -> dict.ContainsKey(key)
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          return new DelphiCall(new DelphiFieldAccess(map, 'ContainsKey'), [key]);
        }

        case 'MapDelete': {
          // IL AST: map.delete(key) -> dict.Remove(key)
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          return new DelphiCall(new DelphiFieldAccess(map, 'Remove'), [key]);
        }

        case 'SetCreation': {
          // IL AST: new Set() -> TList<T>.Create or set type
          return new DelphiCall(
            new DelphiFieldAccess(new DelphiIdentifier('TList'), 'Create'),
            []
          );
        }

        // ========================[ Utility Operations ]========================

        case 'AnsiToBytes': {
          // IL AST: AnsiToBytes(str) -> TEncoding.ASCII.GetBytes(str)
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          return new DelphiCall(
            new DelphiFieldAccess(new DelphiFieldAccess(new DelphiIdentifier('TEncoding'), 'ASCII'), 'GetBytes'),
            args
          );
        }

        case 'Hex8ToBytes': {
          // IL AST: Hex8ToBytes(hex) -> HexToBytes(hex)
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          return new DelphiCall(new DelphiIdentifier('HexToBytes'), args);
        }

        case 'BytesToHex8': {
          // IL AST: BytesToHex8(bytes) -> BytesToHex(bytes)
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          return new DelphiCall(new DelphiIdentifier('BytesToHex'), args);
        }

        case 'Random': {
          // IL AST: Math.random() -> Random (after Randomize)
          return new DelphiCall(new DelphiIdentifier('Random'), []);
        }

        case 'DebugOutput': {
          // IL AST: console.log/warn/error -> WriteLn()
          const args = (node.arguments || []).map(arg => this.transformExpression(arg));
          return new DelphiCall(new DelphiIdentifier('WriteLn'), args);
        }

        case 'ErrorCreation': {
          // IL AST: new Error(message) -> Exception.Create(message)
          const errorType = node.errorType === 'TypeError' ? 'EArgumentException' :
                           node.errorType === 'RangeError' ? 'ERangeError' : 'Exception';
          const msg = node.message ? this.transformExpression(node.message) : DelphiLiteral.String('');
          return new DelphiCall(
            new DelphiFieldAccess(new DelphiIdentifier(errorType), 'Create'),
            [msg]
          );
        }

        case 'ObjectKeys': {
          // IL AST: Object.keys(obj) -> dict.Keys.ToArray
          const obj = this.transformExpression(node.argument || node.object);
          return new DelphiFieldAccess(new DelphiFieldAccess(obj, 'Keys'), 'ToArray');
        }

        case 'ObjectValues': {
          // IL AST: Object.values(obj) -> dict.Values.ToArray
          const obj = this.transformExpression(node.argument || node.object);
          return new DelphiFieldAccess(new DelphiFieldAccess(obj, 'Values'), 'ToArray');
        }

        case 'ObjectEntries': {
          // IL AST: Object.entries(obj) -> iterate dictionary as key-value pairs
          const obj = this.transformExpression(node.argument || node.object);
          return new DelphiFieldAccess(obj, 'ToArray');
        }

        case 'OpCodesCall': {
          // IL AST: OpCodes.method(args) -> transform to equivalent Delphi operation
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          switch (node.method) {
            case 'CopyArray':
              return new DelphiCall(new DelphiIdentifier('Copy'), args.length > 0 ? [args[0]] : []);
            case 'ClearArray':
              return new DelphiCall(new DelphiIdentifier('FillChar'), args);
            default: {
              const opCodesMap = {
                'RotL32': 'RolDWord', 'RotR32': 'RorDWord',
                'RotL8': 'RolByte', 'RotR8': 'RorByte',
                'Pack32LE': 'PackLE', 'Pack32BE': 'PackBE',
                'Unpack32LE': 'UnpackLE', 'Unpack32BE': 'UnpackBE',
                'XorArrays': 'XorBytes',
                'Hex8ToBytes': 'HexToBytes', 'BytesToHex8': 'BytesToHex',
                'AnsiToBytes': 'AnsiStringToBytes', 'BytesToAnsi': 'BytesToAnsiString'
              };
              const delphiFunc = opCodesMap[node.method] || node.method;
              return new DelphiCall(new DelphiIdentifier(delphiFunc), args);
            }
          }
        }

        case 'BigIntCast': {
          // IL AST: BigInt(value) -> use Int64 or custom big integer
          const value = this.transformExpression(node.argument || node.value);
          return new DelphiCall(new DelphiIdentifier('Int64'), [value]);
        }

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
      // Handle undefined - treat same as nil in Delphi
      if (node.value === undefined) {
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
