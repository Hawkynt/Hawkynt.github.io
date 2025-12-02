/**
 * CTransformer.js - JavaScript AST to C AST Transformer
 * Converts type-annotated JavaScript AST to C AST
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> C AST -> C Emitter -> C Source
 */

(function(global) {
  'use strict';

  // Load dependencies
  let CAST;
  if (typeof require !== 'undefined') {
    CAST = require('./CAST.js');
  } else if (global.CAST) {
    CAST = global.CAST;
  }

  const {
    CType, CFile, CInclude, CDefine, CTypedef, CStruct, CField, CEnum, CEnumValue,
    CFunction, CParameter, CBlock, CVariable, CExpressionStatement, CReturn,
    CIf, CFor, CWhile, CDoWhile, CSwitch, CCase, CBreak, CContinue,
    CLiteral, CIdentifier, CBinaryExpression, CUnaryExpression, CAssignment,
    CMemberAccess, CArraySubscript, CCall, CCast, CSizeof, CConditional,
    CArrayInitializer, CStructInitializer, CComma, CComment
  } = CAST;

  /**
   * Maps JavaScript/IL types to C types
   */
  const TYPE_MAP = {
    // Unsigned integers
    'uint8': 'uint8_t', 'byte': 'uint8_t',
    'uint16': 'uint16_t', 'ushort': 'uint16_t', 'word': 'uint16_t',
    'uint32': 'uint32_t', 'uint': 'uint32_t', 'dword': 'uint32_t',
    'uint64': 'uint64_t', 'ulong': 'uint64_t', 'qword': 'uint64_t',
    // Signed integers
    'int8': 'int8_t', 'sbyte': 'int8_t',
    'int16': 'int16_t', 'short': 'int16_t',
    'int32': 'int32_t', 'int': 'int32_t',
    'int64': 'int64_t', 'long': 'int64_t',
    // Floating point
    'float': 'float', 'float32': 'float',
    'double': 'double', 'float64': 'double',
    // In crypto context, JavaScript 'number' typically means uint32 (for bit operations)
    'number': 'uint32_t',
    // Other
    'boolean': 'bool', 'bool': 'bool',
    'string': 'char*',
    'void': 'void',
    'size_t': 'size_t',
    'ptrdiff_t': 'ptrdiff_t'
  };

  /**
   * JavaScript AST to C AST Transformer
   *
   * Supported Options:
   * - standard: C standard ('c89', 'c99', 'c11', 'c17', 'c23')
   * - addComments: Add documentation comments
   * - useStrictTypes: Use strict type annotations
   * - addHeaders: Add standard headers
   * - useConstCorrectness: Use const qualifiers where appropriate
   */
  class CTransformer {
    constructor(options = {}) {
      this.options = options;
      this.standard = options.standard || 'c11';
      this.currentStruct = null;
      this.currentFunction = null;
      this.variableTypes = new Map();  // Maps variable name -> CType
      this.structFieldTypes = new Map(); // Maps field name -> CType
      this.functions = new Map();      // Maps function name -> CFunction
      this.scopeStack = [];
    }

    /**
     * Convert name to snake_case (C convention)
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
     * Convert name to PascalCase (for structs and types)
     */
    toPascalCase(str) {
      if (!str) return str;
      return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Convert name to SCREAMING_SNAKE_CASE (for constants)
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
     * Map JavaScript type string to C type
     */
    mapType(typeName) {
      if (!typeName) return CType.UInt32();

      // Handle arrays - convert to pointers
      if (typeName.endsWith('[]')) {
        const elementTypeName = typeName.slice(0, -2);
        const elementType = this.mapType(elementTypeName);
        return CType.Pointer(elementType);
      }

      const cTypeName = TYPE_MAP[typeName] || typeName;

      // Map to C types
      const typeMap = {
        'uint8_t': CType.UInt8(),
        'uint16_t': CType.UInt16(),
        'uint32_t': CType.UInt32(),
        'uint64_t': CType.UInt64(),
        'int8_t': CType.Int8(),
        'int16_t': CType.Int16(),
        'int32_t': CType.Int32(),
        'int64_t': CType.Int64(),
        'bool': CType.Bool(),
        'char*': CType.Pointer(CType.Char()),
        'void': CType.Void(),
        'size_t': CType.SizeT(),
        'ptrdiff_t': CType.PtrDiffT()
      };

      return typeMap[cTypeName] || new CType(cTypeName);
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
     * Infer C type from variable name pattern
     */
    inferTypeFromName(name) {
      if (!name) return CType.UInt32();

      const lowerName = name.toLowerCase();

      // Byte-related names
      if (lowerName.includes('byte') || lowerName === 'b' || /^b\d$/.test(lowerName)) {
        return CType.UInt8();
      }

      // Array-related names (use pointers for crypto data)
      if (lowerName.includes('key') || lowerName.includes('data') ||
          lowerName.includes('input') || lowerName.includes('output') ||
          lowerName.includes('block') || lowerName.includes('bytes') ||
          lowerName.includes('buffer') || lowerName.includes('state')) {
        const baseType = lowerName.includes('state') ? CType.UInt32() : CType.UInt8();
        const pointerType = CType.Pointer(baseType);
        // For input/key, make it const
        if (lowerName.includes('input') || lowerName.includes('key') || lowerName.includes('nonce') || lowerName.includes('iv')) {
          pointerType.isConst = true;
        }
        return pointerType;
      }

      // Integer-related names
      if (lowerName.includes('index') || lowerName.includes('length') ||
          lowerName.includes('size') || lowerName.includes('count') ||
          lowerName === 'i' || lowerName === 'j' || lowerName === 'n') {
        return CType.SizeT();
      }

      // Default to uint32_t for crypto operations
      return CType.UInt32();
    }

    /**
     * Transform a JavaScript AST to a C AST
     * @param {Object} jsAst - JavaScript AST from parser
     * @returns {CFile} C AST
     */
    transform(jsAst) {
      const file = new CFile();

      // Add standard includes
      if (this.options.addHeaders !== false) {
        file.includes.push(new CInclude('stdint.h', true));
        file.includes.push(new CInclude('stdbool.h', true));
        file.includes.push(new CInclude('stddef.h', true));
        file.includes.push(new CInclude('string.h', true));
      }

      // Add file header comment
      if (this.options.addComments !== false) {
        const standard = this.standard.toUpperCase();
        file.headerComment = new CComment(
          `Generated C code (${standard})\nThis file was automatically generated from JavaScript AST`,
          true
        );
      }

      // Transform the JavaScript AST
      if (jsAst.type === 'Program') {
        for (const node of jsAst.body) {
          this.transformTopLevel(node, file);
        }
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
            if (callee.type === 'FunctionExpression' || callee.type === 'ArrowFunctionExpression') {
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

      // Simple IIFE pattern: extract from callee's body
      if (bodyStatements.length === 0 && calleeNode.body && calleeNode.body.body) {
        bodyStatements = calleeNode.body.body;
      }

      // Process statements
      for (const stmt of bodyStatements) {
        if (stmt.type === 'ExpressionStatement') continue; // Skip 'use strict'
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
        if (decl.id.type === 'ArrayPattern') {
          const sourceExpr = decl.init ? this.transformExpression(decl.init) : null;
          if (sourceExpr) {
            for (let i = 0; i < decl.id.elements.length; ++i) {
              const elem = decl.id.elements[i];
              if (!elem) continue; // Skip holes in destructuring

              const varName = this.toSnakeCase(elem.name);
              const indexExpr = new CArrayAccess(sourceExpr, CLiteral.Int(i));
              const globalVar = new CVariable(varName, CType.Auto(), indexExpr);
              globalVar.type.isStatic = true;
              globalVar.type.isConst = node.kind === 'const';
              targetFile.globals.push(globalVar);
            }
          }
          continue;
        }

        const name = decl.id.name;

        // Handle literals and constants
        if (decl.init.type === 'Literal' || decl.init.type === 'UnaryExpression' ||
            decl.init.type === 'BinaryExpression') {
          const constName = this.toScreamingSnakeCase(name);
          const value = this.transformExpression(decl.init);
          const type = this.inferTypeFromValue(decl.init);

          const define = new CDefine(constName, value);
          targetFile.defines.push(define);
        }
        // Handle array expressions as constants
        else if (decl.init.type === 'ArrayExpression') {
          const constName = this.toSnakeCase(name);
          const type = this.inferTypeFromValue(decl.init);
          const initializer = this.transformExpression(decl.init);

          const globalVar = new CVariable(constName, type, initializer);
          globalVar.type.isStatic = true;
          globalVar.type.isConst = true;
          targetFile.globals.push(globalVar);
        }
      }
    }

    /**
     * Infer C type from a JavaScript value expression
     */
    inferTypeFromValue(valueNode) {
      if (!valueNode) return CType.UInt32();

      switch (valueNode.type) {
        case 'Literal':
          if (typeof valueNode.value === 'number') {
            if (Number.isInteger(valueNode.value)) {
              return valueNode.value >= 0 ? CType.UInt32() : CType.Int32();
            }
            return new CType('double');
          }
          if (typeof valueNode.value === 'string') return CType.Pointer(CType.Char());
          if (typeof valueNode.value === 'boolean') return CType.Bool();
          return CType.UInt32();

        case 'ArrayExpression':
          if (valueNode.elements.length > 0) {
            const elemType = this.inferTypeFromValue(valueNode.elements[0]);
            return CType.Array(elemType, valueNode.elements.length);
          }
          return CType.Array(CType.UInt8(), 0);

        default:
          return CType.UInt32();
      }
    }

    /**
     * Transform a function declaration
     */
    transformFunctionDeclaration(node, targetFile) {
      const funcName = this.toSnakeCase(node.id.name);

      // Infer return type from typeAnnotation or default to void
      let returnType = CType.Void();
      if (node.returnType || node.typeAnnotation) {
        const typeStr = node.returnType || node.typeAnnotation;
        returnType = this.mapType(typeStr);
      }

      const func = new CFunction(funcName, returnType);

      // Parameters
      if (node.params) {
        for (const param of node.params) {
          const paramName = this.toSnakeCase(param.name);
          let paramType = CType.UInt32();

          // Use type annotation if available
          if (param.typeAnnotation) {
            paramType = this.mapType(param.typeAnnotation);
          } else {
            paramType = this.inferTypeFromName(param.name);
          }

          const cParam = new CParameter(paramName, paramType);
          func.parameters.push(cParam);

          this.registerVariableType(param.name, paramType);
        }
      }

      // Body
      if (node.body) {
        this.currentFunction = func;
        func.body = this.transformBlockStatement(node.body);
        this.currentFunction = null;
      }

      targetFile.functions.push(func);
      this.functions.set(funcName, func);
    }

    /**
     * Transform a class declaration to a C struct
     */
    transformClassDeclaration(node, targetFile) {
      const structName = this.toPascalCase(node.id.name);
      const struct = new CStruct(structName);

      const prevStruct = this.currentStruct;
      this.currentStruct = struct;

      // Handle both class body structures
      const members = node.body?.body || node.body || [];

      const methods = [];

      if (members && members.length > 0) {
        for (const member of members) {
          if (member.type === 'MethodDefinition') {
            if (member.kind === 'constructor') {
              // Extract fields from constructor
              const fields = this.extractFieldsFromConstructor(member);
              for (const field of fields) {
                struct.fields.push(field);
              }
            } else {
              // Regular method - convert to function with struct pointer parameter
              const method = this.transformMethodDefinition(member, structName);
              if (method) methods.push(method);
            }
          } else if (member.type === 'PropertyDefinition') {
            // Field
            const field = this.transformPropertyDefinition(member);
            struct.fields.push(field);
          } else if (member.type === 'StaticBlock') {
            // ES2022 static block -> C doesn't have static blocks
            // Transform to global initialization function
            const initStatements = this.transformStaticBlock(member);
            if (initStatements) {
              struct.staticInitStatements = struct.staticInitStatements || [];
              struct.staticInitStatements.push(...initStatements);
            }
          }
        }
      }

      this.currentStruct = prevStruct;

      // Add struct to file
      targetFile.structs.push(struct);

      // Add methods as functions
      for (const method of methods) {
        targetFile.functions.push(method);
      }
    }

    /**
     * Extract fields from constructor's this.x = y assignments
     */
    extractFieldsFromConstructor(node) {
      const fields = [];

      if (!node.value || !node.value.body || node.value.body.type !== 'BlockStatement')
        return fields;

      for (const stmt of node.value.body.body) {
        if (this.isThisPropertyAssignment(stmt)) {
          const expr = stmt.expression;
          const propName = expr.left.property.name || expr.left.property.value;

          // Convert field name to snake_case, removing leading underscore
          let fieldName = this.toSnakeCase(propName);
          if (fieldName.startsWith('_'))
            fieldName = fieldName.substring(1);

          const value = expr.right;
          let fieldType = this.inferTypeFromValue(value);

          const field = new CField(fieldName, fieldType);
          fields.push(field);
          this.structFieldTypes.set(fieldName, fieldType);
        }
      }

      return fields;
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
     * Transform a method definition to a C function
     */
    transformMethodDefinition(node, structName) {
      const methodName = this.toSnakeCase(structName + '_' + node.key.name);

      // Infer return type
      let returnType = CType.Void();
      if (node.value && node.value.returnType) {
        returnType = this.mapType(node.value.returnType);
      }

      const method = new CFunction(methodName, returnType);

      // Add struct pointer as first parameter (unless static)
      if (!node.static) {
        const selfParam = new CParameter('self', CType.Pointer(new CType(structName)));
        method.parameters.push(selfParam);
      }

      // Parameters
      if (node.value && node.value.params) {
        for (const param of node.value.params) {
          const paramName = this.toSnakeCase(param.name);
          let paramType = CType.UInt32();

          if (param.typeAnnotation) {
            paramType = this.mapType(param.typeAnnotation);
          } else {
            paramType = this.inferTypeFromName(param.name);
          }

          const cParam = new CParameter(paramName, paramType);
          method.parameters.push(cParam);

          this.registerVariableType(param.name, paramType);
        }
      }

      // Body
      if (node.value && node.value.body) {
        this.currentFunction = method;
        method.body = this.transformBlockStatement(node.value.body);
        this.currentFunction = null;
      }

      return method;
    }

    /**
     * Transform a property definition
     */
    transformPropertyDefinition(node) {
      const fieldName = this.toSnakeCase(node.key.name);
      let fieldType = CType.UInt32();

      if (node.value) {
        fieldType = this.inferTypeFromValue(node.value);
      } else if (node.typeAnnotation) {
        fieldType = this.mapType(node.typeAnnotation);
      }

      const field = new CField(fieldName, fieldType);
      this.structFieldTypes.set(fieldName, fieldType);

      return field;
    }

    transformStaticBlock(node) {
      // ES2022 static block -> C global initialization statements
      // C doesn't have static class blocks, so transform to statements
      return node.body.map(stmt => this.transformStatement(stmt));
    }

    /**
     * Transform a block statement
     */
    transformBlockStatement(node) {
      const block = new CBlock();

      if (node.body && Array.isArray(node.body)) {
        for (const stmt of node.body) {
          const cStmt = this.transformStatement(stmt);
          if (cStmt) {
            if (Array.isArray(cStmt)) {
              block.statements.push(...cStmt);
            } else {
              block.statements.push(cStmt);
            }
          }
        }
      }

      return block;
    }

    /**
     * Transform a statement
     * CRITICAL: Handles all 16 statement types
     */
    transformStatement(node) {
      if (!node) return null;

      switch (node.type) {
        // 1. VariableDeclaration
        case 'VariableDeclaration':
          return this.transformLocalVariableDeclaration(node);

        // 2. ExpressionStatement
        case 'ExpressionStatement':
          return this.transformExpressionStatementNode(node);

        // 3. ReturnStatement
        case 'ReturnStatement':
          return this.transformReturnStatement(node);

        // 4. IfStatement
        case 'IfStatement':
          return this.transformIfStatement(node);

        // 5. ForStatement
        case 'ForStatement':
          return this.transformForStatement(node);

        // 6. ForOfStatement
        case 'ForOfStatement':
          return this.transformForOfStatement(node);

        // 7. ForInStatement
        case 'ForInStatement':
          return this.transformForInStatement(node);

        // 8. WhileStatement
        case 'WhileStatement':
          return this.transformWhileStatement(node);

        // 9. DoWhileStatement
        case 'DoWhileStatement':
          return this.transformDoWhileStatement(node);

        // 10. SwitchStatement
        case 'SwitchStatement':
          return this.transformSwitchStatement(node);

        // 11. TryStatement
        case 'TryStatement':
          return this.transformTryStatement(node);

        // 12. ThrowStatement
        case 'ThrowStatement':
          return this.transformThrowStatement(node);

        // 13. BlockStatement
        case 'BlockStatement':
          return this.transformBlockStatement(node);

        // 14. BreakStatement
        case 'BreakStatement':
          return new CBreak();

        // 15. ContinueStatement
        case 'ContinueStatement':
          return new CContinue();

        // 16. EmptyStatement
        case 'EmptyStatement':
          return null;

        default:
          return null;
      }
    }

    /**
     * Transform a local variable declaration
     */
    transformLocalVariableDeclaration(node) {
      const statements = [];

      for (const decl of node.declarations) {
        // Skip object destructuring
        if (decl.id.type === 'ObjectPattern') continue;

        // Handle array destructuring: const [a, b, c] = arr;
        if (decl.id.type === 'ArrayPattern') {
          const sourceExpr = decl.init ? this.transformExpression(decl.init) : null;
          if (sourceExpr) {
            for (let i = 0; i < decl.id.elements.length; ++i) {
              const elem = decl.id.elements[i];
              if (!elem) continue; // Skip holes in destructuring

              const varName = this.toSnakeCase(elem.name);
              const indexExpr = new CArrayAccess(sourceExpr, CLiteral.Int(i));
              const varDecl = new CVariableDeclaration(varName, CType.Auto(), indexExpr);
              this.registerVariableType(elem.name, CType.Auto());
              statements.push(varDecl);
            }
          }
          continue;
        }

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
          if (decl.id.typeAnnotation) {
            varType = this.mapType(decl.id.typeAnnotation);
          } else {
            varType = this.inferTypeFromName(decl.id.name);
          }
        }

        const varDecl = new CVariable(varName, varType, initializer);
        this.registerVariableType(decl.id.name, varType);
        statements.push(varDecl);
      }

      return statements;
    }

    /**
     * Transform an expression statement
     */
    transformExpressionStatementNode(node) {
      const expr = this.transformExpression(node.expression);
      if (!expr) return null;
      return new CExpressionStatement(expr);
    }

    /**
     * Transform a return statement
     */
    transformReturnStatement(node) {
      if (node.argument) {
        const expr = this.transformExpression(node.argument);
        return new CReturn(expr);
      }
      return new CReturn();
    }

    /**
     * Transform an if statement
     */
    transformIfStatement(node) {
      const condition = this.transformExpression(node.test);
      const thenBranch = this.transformStatement(node.consequent) || new CBlock();
      const elseBranch = node.alternate ? this.transformStatement(node.alternate) : null;

      // Ensure branches are blocks
      const thenBlock = thenBranch.nodeType === 'Block' ? thenBranch : this.wrapInBlock(thenBranch);
      const elseBlock = elseBranch ? (elseBranch.nodeType === 'Block' ? elseBranch : this.wrapInBlock(elseBranch)) : null;

      return new CIf(condition, thenBlock, elseBlock);
    }

    /**
     * Transform a for statement
     */
    transformForStatement(node) {
      const init = node.init ? this.transformStatement(node.init) : null;
      const condition = node.test ? this.transformExpression(node.test) : null;
      const update = node.update ? this.transformExpression(node.update) : null;
      const body = this.transformStatement(node.body) || new CBlock();

      // Flatten init if it's an array
      const flatInit = (init && Array.isArray(init)) ? init[0] : init;

      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      return new CFor(flatInit, condition, update, bodyBlock);
    }

    /**
     * Transform a for-of statement (convert to standard for loop)
     */
    transformForOfStatement(node) {
      // for (const x of array) -> for (i = 0; i < array_len; i++)
      let varName = 'item';
      if (node.left.type === 'VariableDeclaration') {
        const decl = node.left.declarations[0];
        if (decl && decl.id) {
          varName = this.toSnakeCase(decl.id.name);
        }
      } else if (node.left.type === 'Identifier') {
        varName = this.toSnakeCase(node.left.name);
      }

      // Create index variable
      const indexVar = new CVariable('i', CType.SizeT(), CLiteral.UInt(0, ''));
      const arrayExpr = this.transformExpression(node.right);

      // Create condition: i < array_len (simplified - would need actual array length)
      const condition = new CBinaryExpression(
        new CIdentifier('i'),
        '<',
        new CIdentifier('array_len')
      );

      // Create update: i++
      const update = new CUnaryExpression('++', new CIdentifier('i'));
      update.isPrefix = false;

      const body = this.transformStatement(node.body) || new CBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);

      return new CFor(indexVar, condition, update, bodyBlock);
    }

    /**
     * Transform a for-in statement (not directly supported in C)
     */
    transformForInStatement(node) {
      // for-in is not directly translatable to C - use for loop
      return this.transformForOfStatement(node);
    }

    /**
     * Transform a while statement
     */
    transformWhileStatement(node) {
      const condition = this.transformExpression(node.test);
      const body = this.transformStatement(node.body) || new CBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);
      return new CWhile(condition, bodyBlock);
    }

    /**
     * Transform a do-while statement
     */
    transformDoWhileStatement(node) {
      const condition = this.transformExpression(node.test);
      const body = this.transformStatement(node.body) || new CBlock();
      const bodyBlock = body.nodeType === 'Block' ? body : this.wrapInBlock(body);
      return new CDoWhile(condition, bodyBlock);
    }

    /**
     * Transform a switch statement
     */
    transformSwitchStatement(node) {
      const discriminant = this.transformExpression(node.discriminant);
      const switchStmt = new CSwitch(discriminant);

      for (const caseNode of node.cases) {
        const value = caseNode.test ? this.transformExpression(caseNode.test) : null;
        const statements = [];

        for (const stmt of caseNode.consequent) {
          const cStmt = this.transformStatement(stmt);
          if (cStmt) {
            if (Array.isArray(cStmt)) {
              statements.push(...cStmt);
            } else {
              statements.push(cStmt);
            }
          }
        }

        const cCase = new CCase(value, statements);
        switchStmt.cases.push(cCase);
      }

      return switchStmt;
    }

    /**
     * Transform a try statement (C doesn't have try-catch)
     */
    transformTryStatement(node) {
      // Just transform the try block - ignore catch
      return this.transformStatement(node.block);
    }

    /**
     * Transform a throw statement (C doesn't have throw)
     */
    transformThrowStatement(node) {
      // Convert to return -1 or similar error code
      return new CReturn(CLiteral.Int(-1));
    }

    /**
     * Wrap a statement in a block
     */
    wrapInBlock(stmt) {
      const block = new CBlock();
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
     * Transform an expression
     * CRITICAL: Handles all 19 expression types
     */
    transformExpression(node) {
      if (!node) return null;

      switch (node.type) {
        // 1. Literal
        case 'Literal':
          return this.transformLiteral(node);

        // 2. Identifier
        case 'Identifier':
          return this.transformIdentifier(node);

        // 3. BinaryExpression
        case 'BinaryExpression':
        // 4. LogicalExpression
        case 'LogicalExpression':
          return this.transformBinaryExpression(node);

        // 5. UnaryExpression
        case 'UnaryExpression':
          return this.transformUnaryExpression(node);

        // 6. AssignmentExpression
        case 'AssignmentExpression':
          return this.transformAssignmentExpression(node);

        // 7. UpdateExpression
        case 'UpdateExpression':
          return this.transformUpdateExpression(node);

        // 8. MemberExpression
        case 'MemberExpression':
          return this.transformMemberExpression(node);

        // 9. CallExpression
        case 'CallExpression':
          return this.transformCallExpression(node);

        // 10. ArrayExpression
        case 'ArrayExpression':
          return this.transformArrayExpression(node);

        // 11. ObjectExpression
        case 'ObjectExpression':
          return this.transformObjectExpression(node);

        // 12. NewExpression
        case 'NewExpression':
          return this.transformNewExpression(node);

        // 13. ThisExpression
        case 'ThisExpression':
          return new CIdentifier('self');

        // 13b. Super (treated as parent struct pointer in C)
        case 'Super':
          return new CIdentifier('super');

        // 14. ConditionalExpression
        case 'ConditionalExpression':
          return this.transformConditionalExpression(node);

        // 15. ArrowFunctionExpression
        case 'ArrowFunctionExpression':
        // 16. FunctionExpression
        case 'FunctionExpression':
          return this.transformFunctionExpression(node);

        // 17. SequenceExpression
        case 'SequenceExpression':
          return this.transformSequenceExpression(node);

        // 18. SpreadElement
        case 'SpreadElement':
          return this.transformSpreadElement(node);

        // 19. TemplateLiteral
        case 'TemplateLiteral':
          return this.transformTemplateLiteral(node);

        // 20. ObjectPattern (destructuring)
        case 'ObjectPattern':
          // Object destructuring - C doesn't support this directly
          // Return a comment placeholder
          return new CIdentifier('/* Object destructuring not supported in C */');

        default:
          return null;
      }
    }

    /**
     * Transform a literal
     */
    transformLiteral(node) {
      if (typeof node.value === 'number') {
        if (Number.isInteger(node.value)) {
          const suffix = node.value >= 0 ? 'U' : '';
          return CLiteral.UInt(node.value, suffix);
        }
        return new CLiteral(node.value, 'float');
      }

      if (typeof node.value === 'string') {
        return CLiteral.String(node.value);
      }

      if (typeof node.value === 'boolean') {
        return CLiteral.Bool(node.value);
      }

      if (node.value === null) {
        return CLiteral.Null();
      }

      return new CLiteral(node.value, 'unknown');
    }

    /**
     * Transform an identifier
     */
    transformIdentifier(node) {
      let name = node.name;

      // Map JavaScript keywords to C equivalents
      if (name === 'undefined') return CLiteral.Null();
      if (name === 'null') return CLiteral.Null();

      return new CIdentifier(this.toSnakeCase(name));
    }

    /**
     * Transform a binary expression
     */
    transformBinaryExpression(node) {
      let left = this.transformExpression(node.left);
      let right = this.transformExpression(node.right);

      // Map operators
      let operator = node.operator;
      if (operator === '===') operator = '==';
      if (operator === '!==') operator = '!=';

      // Handle JavaScript >>> (unsigned right shift)
      if (operator === '>>>') {
        operator = '>>';
        // Cast left to unsigned for unsigned shift
        left = new CCast(CType.UInt32(), left);
      }

      return new CBinaryExpression(left, operator, right);
    }

    /**
     * Transform a unary expression
     */
    transformUnaryExpression(node) {
      const operand = this.transformExpression(node.argument);

      let operator = node.operator;
      if (operator === 'typeof') {
        // C doesn't have typeof - return comment
        return new CIdentifier('/* typeof */');
      }

      return new CUnaryExpression(operator, operand);
    }

    /**
     * Transform an assignment expression
     */
    transformAssignmentExpression(node) {
      const left = this.transformExpression(node.left);
      const right = this.transformExpression(node.right);
      return new CAssignment(left, node.operator, right);
    }

    /**
     * Transform an update expression (++, --)
     */
    transformUpdateExpression(node) {
      const operand = this.transformExpression(node.argument);
      const unary = new CUnaryExpression(node.operator, operand);
      unary.isPrefix = node.prefix;
      return unary;
    }

    /**
     * Transform a member expression
     */
    transformMemberExpression(node) {
      const object = this.transformExpression(node.object);

      if (node.computed) {
        // Array indexing
        const index = this.transformExpression(node.property);
        return new CArraySubscript(object, index);
      } else {
        // Field access
        const member = node.property.name || node.property.value;
        const fieldName = this.toSnakeCase(member);

        // Determine if pointer or direct access (use -> for pointers)
        const isPointer = this.isPointerType(node.object);
        return new CMemberAccess(object, fieldName, isPointer);
      }
    }

    /**
     * Check if an expression is a pointer type
     */
    isPointerType(node) {
      // Simple heuristic - could be improved with type tracking
      if (node.type === 'ThisExpression') return false;
      if (node.type === 'Identifier' && node.name === 'self') return true;
      return false;
    }

    /**
     * Transform a call expression
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
        const methodName = this.toSnakeCase(method);
        const args = [object, ...node.arguments.map(arg => this.transformExpression(arg))];

        // Convert to function call with object as first parameter
        return new CCall(new CIdentifier(methodName), args);
      }

      // Regular function call
      const callee = this.transformExpression(node.callee);
      const args = node.arguments.map(arg => this.transformExpression(arg));

      return new CCall(callee, args);
    }

    /**
     * Transform OpCodes method calls to C equivalents
     */
    transformOpCodesCall(node) {
      const methodName = node.callee.property.name;
      const args = node.arguments.map(arg => this.transformExpression(arg));

      // Map OpCodes methods to C equivalents
      switch (methodName) {
        // Rotation operations (need inline functions or macros)
        case 'RotL32':
          return new CCall(new CIdentifier('rotl32'), args);
        case 'RotR32':
          return new CCall(new CIdentifier('rotr32'), args);
        case 'RotL64':
          return new CCall(new CIdentifier('rotl64'), args);
        case 'RotR64':
          return new CCall(new CIdentifier('rotr64'), args);

        // Byte packing
        case 'Pack32LE':
          return new CCall(new CIdentifier('pack32_le'), args);
        case 'Pack32BE':
          return new CCall(new CIdentifier('pack32_be'), args);
        case 'Pack64LE':
          return new CCall(new CIdentifier('pack64_le'), args);
        case 'Pack64BE':
          return new CCall(new CIdentifier('pack64_be'), args);

        // Byte unpacking
        case 'Unpack32LE':
          return new CCall(new CIdentifier('unpack32_le'), args);
        case 'Unpack32BE':
          return new CCall(new CIdentifier('unpack32_be'), args);

        // Array operations
        case 'XorArrays':
          return new CCall(new CIdentifier('xor_arrays'), args);
        case 'ClearArray':
          return new CCall(new CIdentifier('memset'), [args[0], CLiteral.UInt(0, ''), new CSizeof(args[0], false)]);

        // Conversion utilities
        case 'Hex8ToBytes':
          return new CCall(new CIdentifier('hex_to_bytes'), args);
        case 'BytesToHex8':
          return new CCall(new CIdentifier('bytes_to_hex'), args);

        default:
          return new CCall(new CIdentifier(this.toSnakeCase(methodName)), args);
      }
    }

    /**
     * Transform an array expression
     */
    transformArrayExpression(node) {
      const elements = node.elements.map(elem => elem ? this.transformExpression(elem) : CLiteral.UInt(0, ''));
      return new CArrayInitializer(elements);
    }

    /**
     * Transform an object expression (to struct initializer)
     */
    transformObjectExpression(node) {
      const fields = [];
      for (const prop of node.properties) {
        if (!prop.key) continue;
        const key = prop.key.name || prop.key.value || 'unknown';
        const value = this.transformExpression(prop.value);
        fields.push({ name: this.toSnakeCase(key), value });
      }
      return new CStructInitializer(fields);
    }

    /**
     * Transform a new expression
     */
    transformNewExpression(node) {
      if (node.callee.type === 'Identifier') {
        const typeName = node.callee.name;

        // Map TypedArrays to C arrays with malloc
        const typedArrayMap = {
          'Uint8Array': 'uint8_t',
          'Uint16Array': 'uint16_t',
          'Uint32Array': 'uint32_t',
          'Int8Array': 'int8_t',
          'Int16Array': 'int16_t',
          'Int32Array': 'int32_t'
        };

        if (typedArrayMap[typeName]) {
          const size = node.arguments[0] ? this.transformExpression(node.arguments[0]) : CLiteral.UInt(0, '');
          // Generate malloc call: (type*)malloc(size * sizeof(type))
          const sizeofExpr = new CSizeof(new CType(typedArrayMap[typeName]), true);
          const totalSize = new CBinaryExpression(size, '*', sizeofExpr);
          const mallocCall = new CCall(new CIdentifier('malloc'), [totalSize]);
          return new CCast(CType.Pointer(new CType(typedArrayMap[typeName])), mallocCall);
        }

        // Handle Array constructor
        if (typeName === 'Array') {
          const size = node.arguments[0] ? this.transformExpression(node.arguments[0]) : CLiteral.UInt(0, '');
          const sizeofExpr = new CSizeof(CType.UInt8(), true);
          const totalSize = new CBinaryExpression(size, '*', sizeofExpr);
          const mallocCall = new CCall(new CIdentifier('malloc'), [totalSize]);
          return new CCast(CType.Pointer(CType.UInt8()), mallocCall);
        }

        // Struct constructor - convert to function call
        const funcName = this.toSnakeCase(typeName + '_new');
        const args = node.arguments.map(arg => this.transformExpression(arg));
        return new CCall(new CIdentifier(funcName), args);
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
      return new CConditional(condition, thenExpr, elseExpr);
    }

    /**
     * Transform a function expression (function pointers in C)
     */
    transformFunctionExpression(node) {
      // C doesn't directly support inline functions - return identifier to function
      return new CIdentifier('/* function expression */');
    }

    /**
     * Transform a sequence expression
     */
    transformSequenceExpression(node) {
      const expressions = node.expressions.map(expr => this.transformExpression(expr));
      return new CComma(expressions);
    }

    /**
     * Transform a spread element
     */
    transformSpreadElement(node) {
      // Spread not directly supported in C - just return the argument
      return this.transformExpression(node.argument);
    }

    /**
     * Transform a template literal
     */
    transformTemplateLiteral(node) {
      // Convert to sprintf or simple string - simplified for now
      let result = '';
      for (let i = 0; i < node.quasis.length; i++) {
        result += node.quasis[i].value.raw;
        if (i < node.expressions.length) {
          result += '%s'; // Placeholder
        }
      }
      return CLiteral.String(result);
    }
  }

  // Export
  const exports = { CTransformer };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.CTransformer = CTransformer;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
