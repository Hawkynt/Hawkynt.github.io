/**
 * JavaTransformer.js - IL AST to Java AST Transformer
 * Converts IL AST (type-inferred, language-agnostic) to Java AST
 * (c)2006-2025 Hawkynt
 *
 * Full Pipeline:
 *   JS Source → Parser → JS AST → IL Transformer → IL AST → Language Transformer → Language AST → Language Emitter → Language Source
 *
 * This transformer handles: IL AST → Java AST
 *
 * IL AST characteristics:
 *   - Type-inferred (no untyped nodes)
 *   - Language-agnostic (no JS-specific constructs like UMD, IIFE, Math.*, Object.*, etc.)
 *   - Global options already applied
 *
 * Language options (applied here and in emitter):
 *   - packageName: Java package name
 *   - className: Main class name
 *
 * Java-specific transformations:
 *   - uint8 → byte (signed in Java, requires masking for unsigned semantics)
 *   - uint32 → int (requires Integer.toUnsignedLong() for unsigned operations)
 *   - uint64 → long (requires Long.compareUnsigned() etc.)
 *   - byte[] → byte[]
 *   - Arrays are objects in Java (use .length not .length())
 *   - camelCase for methods, UPPER_SNAKE_CASE for constants
 *   - No properties - use getters/setters
 */

(function(global) {
  'use strict';

  // Load dependencies
  let JavaAST;
  if (typeof require !== 'undefined') {
    JavaAST = require('./JavaAST.js');
  } else if (global.JavaAST) {
    JavaAST = global.JavaAST;
  }

  const {
    JavaType, JavaCompilationUnit, JavaPackageDeclaration, JavaImportDeclaration,
    JavaClass, JavaInterface, JavaField, JavaMethod, JavaConstructor, JavaParameter,
    JavaBlock, JavaVariableDeclaration, JavaExpressionStatement, JavaReturn,
    JavaIf, JavaFor, JavaForEach, JavaWhile, JavaDoWhile, JavaSwitch, JavaSwitchCase,
    JavaBreak, JavaContinue, JavaThrow, JavaTryCatch, JavaCatchClause, JavaSynchronized,
    JavaLiteral, JavaIdentifier, JavaBinaryExpression, JavaUnaryExpression,
    JavaAssignment, JavaMemberAccess, JavaArrayAccess, JavaMethodCall,
    JavaObjectCreation, JavaArrayCreation, JavaCast, JavaConditional, JavaLambda,
    JavaThis, JavaSuper, JavaInstanceOf, JavaParenthesized, JavaDoc
  } = JavaAST;

  /**
   * Maps JavaScript/JSDoc types to Java types
   */
  const TYPE_MAP = {
    // Unsigned integers (Java doesn't have unsigned primitives until Java 8 wrapper helpers)
    'uint8': 'byte',      // Java byte is signed, use & 0xFF for unsigned
    'byte': 'byte',
    'uint16': 'short',    // Java short is signed, use & 0xFFFF for unsigned
    'ushort': 'short',
    'word': 'short',
    'uint32': 'int',      // Java int is signed, use Integer.toUnsignedLong() etc.
    'uint': 'int',
    'dword': 'int',
    'uint64': 'long',     // Java long is signed, use Long.compareUnsigned() etc.
    'ulong': 'long',
    'qword': 'long',

    // Signed integers
    'int8': 'byte',
    'sbyte': 'byte',
    'int16': 'short',
    'short': 'short',
    'int32': 'int',
    'int': 'int',
    'int64': 'long',
    'long': 'long',

    // Floating point
    'float': 'float',
    'float32': 'float',
    'double': 'double',
    'float64': 'double',
    'number': 'int',      // In crypto context, number typically means uint32

    // Other
    'boolean': 'boolean',
    'bool': 'boolean',
    'string': 'String',
    'String': 'String',
    'BigInt': 'BigInteger',
    'bigint': 'BigInteger',
    'void': 'void',
    'object': 'Object',
    'Object': 'Object',
    'any': 'Object'
  };

  /**
   * Java reserved words that cannot be used as identifiers
   */
  const RESERVED_WORDS = new Set([
    'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char',
    'class', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum',
    'extends', 'final', 'finally', 'float', 'for', 'goto', 'if', 'implements',
    'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new', 'null',
    'package', 'private', 'protected', 'public', 'return', 'short', 'static',
    'strictfp', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws',
    'transient', 'try', 'void', 'volatile', 'while', 'true', 'false'
  ]);

  /**
   * JavaScript AST to Java AST Transformer
   */
  class JavaTransformer {
    constructor(options = {}) {
      this.options = options;
      this.packageName = options.packageName || 'com.generated';
      this.className = options.className || 'GeneratedClass';
      this.typeKnowledge = options.typeKnowledge || null;
      this.currentClass = null;
      this.currentMethod = null;
      this.variableTypes = new Map();
      this.imports = new Set();
      this.warnings = [];
    }

    /**
     * Transform JavaScript AST to Java AST
     * @param {Object} jsAst - JavaScript AST from parser
     * @returns {JavaCompilationUnit} Java AST
     */
    transform(jsAst) {
      const cu = new JavaCompilationUnit();

      // Package declaration
      cu.packageDeclaration = new JavaPackageDeclaration(this.packageName);

      // Standard imports
      this.addImport('java.util.*');
      this.addImport('java.math.BigInteger');

      // Add framework stub types first (if enabled)
      if (this.options.includeFrameworkStubs !== false) {
        const frameworkStubs = this.createFrameworkStubs();
        for (const stub of frameworkStubs) {
          cu.types.push(stub);
        }
      }

      // Transform the program
      if (jsAst.type === 'Program') {
        const mainClass = this.transformProgram(jsAst);
        cu.types.push(mainClass);
      }

      // Add imports to compilation unit
      for (const imp of this.imports) {
        cu.imports.push(new JavaImportDeclaration(imp, false, imp.endsWith('*')));
      }

      return cu;
    }

    /**
     * Create framework stub types for algorithm metadata
     * These allow the code to compile without the actual AlgorithmFramework
     */
    createFrameworkStubs() {
      const stubs = [];

      // CategoryType enum (package-private to avoid one-public-class-per-file)
      const categoryType = new JavaClass('CategoryType');
      categoryType.isEnum = true;
      categoryType.accessModifier = '';
      categoryType.enumConstants = ['BLOCK', 'STREAM', 'HASH', 'MAC', 'KDF', 'AEAD',
                                     'ASYMMETRIC', 'ENCODING', 'COMPRESSION', 'CLASSICAL',
                                     'ECC', 'CHECKSUM', 'SPECIAL', 'RANDOM', 'MODES'];
      stubs.push(categoryType);

      // SecurityStatus enum
      const securityStatus = new JavaClass('SecurityStatus');
      securityStatus.isEnum = true;
      securityStatus.accessModifier = '';
      securityStatus.enumConstants = ['SECURE', 'BROKEN', 'DEPRECATED', 'EXPERIMENTAL',
                                       'EDUCATIONAL', 'OBSOLETE'];
      stubs.push(securityStatus);

      // ComplexityType enum
      const complexityType = new JavaClass('ComplexityType');
      complexityType.isEnum = true;
      complexityType.accessModifier = '';
      complexityType.enumConstants = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT', 'RESEARCH'];
      stubs.push(complexityType);

      // CountryCode enum
      const countryCode = new JavaClass('CountryCode');
      countryCode.isEnum = true;
      countryCode.accessModifier = '';
      countryCode.enumConstants = ['US', 'GB', 'DE', 'FR', 'IL', 'RU', 'CN', 'JP', 'BE',
                                    'CH', 'NL', 'AU', 'CA', 'KR', 'INTERNATIONAL', 'UNKNOWN'];
      stubs.push(countryCode);

      // KeySize class
      const keySize = this.createStubClass('KeySize',
        [['minSize', 'int'], ['maxSize', 'int'], ['step', 'int']]);
      stubs.push(keySize);

      // LinkItem class
      const linkItem = this.createStubClass('LinkItem',
        [['text', 'String'], ['url', 'String']]);
      stubs.push(linkItem);

      // Vulnerability class (extends LinkItem conceptually, but we'll make it standalone)
      const vulnerability = this.createStubClass('Vulnerability',
        [['name', 'String'], ['mitigation', 'String'], ['url', 'String']]);
      stubs.push(vulnerability);

      // TestCase class
      const testCase = this.createStubClass('TestCase',
        [['input', 'byte[]'], ['expected', 'byte[]'], ['description', 'String'], ['source', 'String']]);
      stubs.push(testCase);

      // IAlgorithmInstance interface
      const iAlgInstance = new JavaClass('IAlgorithmInstance');
      iAlgInstance.isInterface = true;
      iAlgInstance.accessModifier = '';
      const feedMethod = new JavaMethod('feed');
      feedMethod.returnType = JavaType.Void();
      feedMethod.parameters = [new JavaParameter('data', new JavaType('byte[]'))];
      feedMethod.isAbstract = true;
      iAlgInstance.members.push(feedMethod);
      const resultMethod = new JavaMethod('result');
      resultMethod.returnType = new JavaType('byte[]');
      resultMethod.isAbstract = true;
      iAlgInstance.members.push(resultMethod);
      stubs.push(iAlgInstance);

      // IBlockCipherInstance interface (extends IAlgorithmInstance)
      const iBlockInstance = new JavaClass('IBlockCipherInstance');
      iBlockInstance.isInterface = true;
      iBlockInstance.accessModifier = '';
      iBlockInstance.extendsInterfaces = [new JavaType('IAlgorithmInstance')];
      // Use abstract getter/setter methods instead of fields for interfaces
      const getKey = new JavaMethod('getKey');
      getKey.returnType = new JavaType('byte[]');
      getKey.isAbstract = true;
      iBlockInstance.members.push(getKey);
      const setKey = new JavaMethod('setKey');
      setKey.returnType = JavaType.Void();
      setKey.parameters = [new JavaParameter('key', new JavaType('byte[]'))];
      setKey.isAbstract = true;
      iBlockInstance.members.push(setKey);
      stubs.push(iBlockInstance);

      // IHashFunctionInstance interface (extends IAlgorithmInstance)
      const iHashInstance = new JavaClass('IHashFunctionInstance');
      iHashInstance.isInterface = true;
      iHashInstance.accessModifier = '';
      iHashInstance.extendsInterfaces = [new JavaType('IAlgorithmInstance')];
      stubs.push(iHashInstance);

      // IStreamCipherInstance interface (extends IAlgorithmInstance)
      const iStreamInstance = new JavaClass('IStreamCipherInstance');
      iStreamInstance.isInterface = true;
      iStreamInstance.accessModifier = '';
      iStreamInstance.extendsInterfaces = [new JavaType('IAlgorithmInstance')];
      const getKeyStream = new JavaMethod('getKey');
      getKeyStream.returnType = new JavaType('byte[]');
      getKeyStream.isAbstract = true;
      iStreamInstance.members.push(getKeyStream);
      const setKeyStream = new JavaMethod('setKey');
      setKeyStream.returnType = JavaType.Void();
      setKeyStream.parameters = [new JavaParameter('key', new JavaType('byte[]'))];
      setKeyStream.isAbstract = true;
      iStreamInstance.members.push(setKeyStream);
      const getIV = new JavaMethod('getIV');
      getIV.returnType = new JavaType('byte[]');
      getIV.isAbstract = true;
      iStreamInstance.members.push(getIV);
      const setIV = new JavaMethod('setIV');
      setIV.returnType = JavaType.Void();
      setIV.parameters = [new JavaParameter('iv', new JavaType('byte[]'))];
      setIV.isAbstract = true;
      iStreamInstance.members.push(setIV);
      stubs.push(iStreamInstance);

      // Algorithm base class
      const algorithm = this.createAlgorithmBaseClass('Algorithm');
      stubs.push(algorithm);

      // CryptoAlgorithm extends Algorithm
      const cryptoAlg = this.createDerivedAlgorithmClass('CryptoAlgorithm', 'Algorithm');
      stubs.push(cryptoAlg);

      // SymmetricCipherAlgorithm extends CryptoAlgorithm
      const symAlg = this.createDerivedAlgorithmClass('SymmetricCipherAlgorithm', 'CryptoAlgorithm');
      stubs.push(symAlg);

      // BlockCipherAlgorithm extends SymmetricCipherAlgorithm
      const blockAlg = this.createDerivedAlgorithmClass('BlockCipherAlgorithm', 'SymmetricCipherAlgorithm');
      stubs.push(blockAlg);

      // StreamCipherAlgorithm extends SymmetricCipherAlgorithm
      const streamAlg = this.createDerivedAlgorithmClass('StreamCipherAlgorithm', 'SymmetricCipherAlgorithm');
      stubs.push(streamAlg);

      // HashFunctionAlgorithm extends CryptoAlgorithm
      const hashAlg = this.createDerivedAlgorithmClass('HashFunctionAlgorithm', 'CryptoAlgorithm');
      stubs.push(hashAlg);

      // MacAlgorithm extends CryptoAlgorithm
      const macAlg = this.createDerivedAlgorithmClass('MacAlgorithm', 'CryptoAlgorithm');
      stubs.push(macAlg);

      // EncodingAlgorithm extends Algorithm
      const encAlg = this.createDerivedAlgorithmClass('EncodingAlgorithm', 'Algorithm');
      stubs.push(encAlg);

      // CompressionAlgorithm extends Algorithm
      const compAlg = this.createDerivedAlgorithmClass('CompressionAlgorithm', 'Algorithm');
      stubs.push(compAlg);

      // ChecksumAlgorithm extends Algorithm
      const checksumAlg = this.createDerivedAlgorithmClass('ChecksumAlgorithm', 'Algorithm');
      stubs.push(checksumAlg);

      return stubs;
    }

    /**
     * Create a simple data class with constructor and fields
     */
    createStubClass(name, fields) {
      const cls = new JavaClass(name);
      cls.accessModifier = '';  // package-private

      // Add fields
      for (const [fieldName, fieldType] of fields) {
        const field = new JavaField(fieldName, new JavaType(fieldType));
        field.accessModifier = 'public';
        cls.members.push(field);
      }

      // Add constructor
      const ctor = new JavaConstructor(name);
      ctor.accessModifier = 'public';
      for (const [fieldName, fieldType] of fields) {
        ctor.parameters.push(new JavaParameter(fieldName, new JavaType(fieldType)));
      }
      ctor.body = new JavaBlock();
      for (const [fieldName, _] of fields) {
        const assign = new JavaExpressionStatement(
          new JavaAssignment(
            new JavaMemberAccess(new JavaThis(), fieldName),
            '=',
            new JavaIdentifier(fieldName)
          )
        );
        ctor.body.statements.push(assign);
      }
      cls.members.push(ctor);

      return cls;
    }

    /**
     * Create the base Algorithm class with common fields
     */
    createAlgorithmBaseClass(name) {
      const cls = new JavaClass(name);
      cls.accessModifier = '';  // package-private
      cls.isAbstract = true;

      // Common algorithm metadata fields
      const fields = [
        ['name', 'String'],
        ['description', 'String'],
        ['inventor', 'String'],
        ['year', 'int'],
        ['category', 'CategoryType'],
        ['subCategory', 'String'],
        ['securityStatus', 'SecurityStatus'],
        ['complexity', 'ComplexityType'],
        ['country', 'CountryCode']
      ];

      for (const [fieldName, fieldType] of fields) {
        const field = new JavaField(fieldName, new JavaType(fieldType));
        field.accessModifier = 'protected';
        cls.members.push(field);
      }

      // List fields for collections
      const listFields = [
        ['documentation', 'LinkItem'],
        ['references', 'LinkItem'],
        ['knownVulnerabilities', 'Vulnerability'],
        ['supportedKeySizes', 'KeySize'],
        ['supportedBlockSizes', 'KeySize']
      ];

      for (const [fieldName, elementType] of listFields) {
        const field = new JavaField(fieldName, new JavaType(`List<${elementType}>`));
        field.accessModifier = 'protected';
        field.initializer = new JavaObjectCreation(new JavaType('ArrayList<>'));
        cls.members.push(field);
      }

      // Abstract createInstance method
      const createInstance = new JavaMethod('createInstance');
      createInstance.accessModifier = 'public';
      createInstance.isAbstract = true;
      createInstance.returnType = new JavaType('IAlgorithmInstance');
      createInstance.parameters = [new JavaParameter('isInverse', JavaType.Boolean())];
      cls.members.push(createInstance);

      return cls;
    }

    /**
     * Create a derived algorithm class that extends a parent
     */
    createDerivedAlgorithmClass(name, parentName) {
      const cls = new JavaClass(name);
      cls.accessModifier = '';  // package-private
      cls.isAbstract = true;
      cls.extendsClass = parentName;
      return cls;
    }

    addImport(packageName) {
      this.imports.add(packageName);
    }

    /**
     * Transform Program node to Java class
     */
    transformProgram(node) {
      const javaClass = new JavaClass(this.className);
      javaClass.accessModifier = '';  // package-private to allow multiple types in one file
      this.currentClass = javaClass;

      // Process all top-level declarations
      for (const stmt of node.body) {
        // Check for IIFE wrapper (UMD pattern) and extract content
        if (this.isIIFE(stmt)) {
          const extractedDecls = this.extractIIFEContent(stmt);
          for (const decl of extractedDecls) {
            if (decl.nodeType === 'Class') {
              javaClass.nestedTypes.push(decl);
            } else if (decl.nodeType === 'Method') {
              decl.isStatic = true;
              javaClass.members.push(decl);
            } else if (decl.nodeType === 'Field') {
              javaClass.members.push(decl);
            }
          }
        } else if (stmt.type === 'ClassDeclaration') {
          // Nested class
          const nestedClass = this.transformClassDeclaration(stmt);
          javaClass.nestedTypes.push(nestedClass);
        } else if (stmt.type === 'FunctionDeclaration') {
          // Static method
          const method = this.transformFunctionDeclaration(stmt);
          method.isStatic = true;
          javaClass.members.push(method);
        } else if (stmt.type === 'VariableDeclaration') {
          // Static field
          const fields = this.transformVariableDeclaration(stmt, true);
          javaClass.members.push(...fields);
        }
      }

      return javaClass;
    }

    /**
     * Check if a node is an IIFE (Immediately Invoked Function Expression)
     */
    isIIFE(node) {
      if (node.type !== 'ExpressionStatement') return false;
      if (node.expression.type !== 'CallExpression') return false;
      const callee = node.expression.callee;
      return callee.type === 'FunctionExpression' || callee.type === 'ArrowFunctionExpression';
    }

    /**
     * Extract content from IIFE wrapper
     * Handles UMD pattern: (function(root, factory) { ... })((function(){...})(), function(deps) { ... })
     */
    extractIIFEContent(node) {
      const results = [];
      const callExpr = node.expression;

      // First, try to find the factory function in UMD pattern
      if (callExpr.arguments && callExpr.arguments.length >= 2) {
        const factoryArg = callExpr.arguments[1];
        if (factoryArg.type === 'FunctionExpression' || factoryArg.type === 'ArrowFunctionExpression') {
          if (factoryArg.body && factoryArg.body.body) {
            for (const stmt of factoryArg.body.body) {
              const transformed = this.transformTopLevelStatement(stmt);
              if (transformed) {
                if (Array.isArray(transformed)) {
                  results.push(...transformed);
                } else {
                  results.push(transformed);
                }
              }
            }
            return results;
          }
        }
      }

      // Simple IIFE pattern
      const callee = callExpr.callee;
      if (callee.body && callee.body.body) {
        for (const stmt of callee.body.body) {
          const transformed = this.transformTopLevelStatement(stmt);
          if (transformed) {
            if (Array.isArray(transformed)) {
              results.push(...transformed);
            } else {
              results.push(transformed);
            }
          }
        }
      }

      return results;
    }

    /**
     * Transform a top-level statement from IIFE content
     */
    transformTopLevelStatement(node) {
      if (node.type === 'ExpressionStatement') return null;
      if (node.type === 'IfStatement') return null;

      if (node.type === 'ClassDeclaration') {
        return this.transformClassDeclaration(node);
      }
      if (node.type === 'FunctionDeclaration') {
        return this.transformFunctionDeclaration(node);
      }
      if (node.type === 'VariableDeclaration') {
        return this.transformVariableDeclaration(node, true);
      }

      return null;
    }

    /**
     * Transform ClassDeclaration to JavaClass
     */
    transformClassDeclaration(node) {
      const javaClass = new JavaClass(node.id.name);
      javaClass.accessModifier = 'public';
      javaClass.isStatic = true; // Nested classes are static by default

      const prevClass = this.currentClass;
      this.currentClass = javaClass;

      // Handle extends clause first
      if (node.superClass) {
        const superClassName = node.superClass.type === 'Identifier'
          ? node.superClass.name
          : this.transformExpression(node.superClass).name;

        // Check if superclass is actually an interface (starts with 'I' and is a known interface)
        const knownInterfaces = ['IAlgorithmInstance', 'IBlockCipherInstance', 'IHashFunctionInstance'];
        if (knownInterfaces.includes(superClassName)) {
          javaClass.implementsInterfaces.push(new JavaType(superClassName));
        } else {
          javaClass.extendsClass = superClassName;
        }
      }

      // Process class body - handle both ClassBody and unwrapped arrays
      let members = [];
      if (node.body) {
        if (node.body.type === 'ClassBody' && node.body.body) {
          members = node.body.body;
        } else if (Array.isArray(node.body)) {
          // Unwrapped UMD pattern - body is array directly
          members = node.body;
        }
      }

      for (const member of members) {
        try {
          if (member.type === 'MethodDefinition') {
            if (member.kind === 'constructor') {
              // First, extract fields from constructor body (this.X = Y assignments)
              const extractedFields = this.extractFieldsFromConstructor(member);
              for (const field of extractedFields) {
                // Check if field already exists (from PropertyDefinition)
                const existingField = javaClass.members.find(m =>
                  m.nodeType === 'Field' && m.name === field.name);
                if (!existingField)
                  javaClass.members.push(field);
              }

              const constructor = this.transformConstructor(member, javaClass.name);
              javaClass.members.push(constructor);
            } else if (member.kind === 'method') {
              const method = this.transformMethodDefinition(member);
              javaClass.members.push(method);
            } else if (member.kind === 'get') {
              // Getter method
              const getter = this.transformMethodDefinition(member);
              getter.name = 'get' + this.toPascalCase(getter.name);
              javaClass.members.push(getter);
            } else if (member.kind === 'set') {
              // Setter method
              const setter = this.transformMethodDefinition(member);
              setter.name = 'set' + this.toPascalCase(setter.name);
              javaClass.members.push(setter);
            }
          } else if (member.type === 'PropertyDefinition' || member.type === 'FieldDefinition') {
            const field = this.transformPropertyDefinition(member);
            javaClass.members.push(field);
          } else if (member.type === 'StaticBlock') {
            // ES2022 static initialization block -> Java static initializer
            const staticBlock = this.transformStaticBlock(member);
            javaClass.members.push(staticBlock);
          } else {
            // Unknown member type
            this.warnings.push(`Unknown class member type: ${member.type} in class ${javaClass.name}`);
          }
        } catch (error) {
          this.warnings.push(`Error transforming class member: ${error.message}`);
        }
      }

      this.currentClass = prevClass;
      return javaClass;
    }

    /**
     * Transform FunctionDeclaration to JavaMethod
     */
    transformFunctionDeclaration(node) {
      const returnType = this.inferReturnType(node);
      const method = new JavaMethod(this.toCamelCase(node.id.name), returnType);

      const prevMethod = this.currentMethod;
      this.currentMethod = method;

      // Parameters
      for (const param of node.params) {
        method.parameters.push(this.transformParameter(param));
      }

      // Body
      if (node.body) {
        method.body = this.transformBlockStatement(node.body);
      }

      this.currentMethod = prevMethod;
      return method;
    }

    /**
     * Transform MethodDefinition to JavaMethod
     */
    transformMethodDefinition(node) {
      const returnType = this.inferReturnType(node.value);
      const methodName = this.toCamelCase(node.key.name);
      const method = new JavaMethod(methodName, returnType);

      method.isStatic = node.static || false;

      const prevMethod = this.currentMethod;
      this.currentMethod = method;

      // Parameters
      if (node.value && node.value.params) {
        for (const param of node.value.params) {
          method.parameters.push(this.transformParameter(param));
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
     * Transform constructor
     */
    transformConstructor(node, className) {
      const constructor = new JavaConstructor(className);

      // Parameters
      if (node.value && node.value.params) {
        for (const param of node.value.params) {
          constructor.parameters.push(this.transformParameter(param));
        }
      }

      // Body
      if (node.value && node.value.body) {
        constructor.body = this.transformBlockStatement(node.value.body);
      }

      return constructor;
    }

    /**
     * Extract fields from constructor assignments (this.X = Y)
     * Returns array of JavaField objects
     */
    extractFieldsFromConstructor(constructorNode) {
      const fields = [];
      const seenFields = new Set();

      if (!constructorNode?.value?.body?.body) return fields;

      for (const stmt of constructorNode.value.body.body) {
        // Handle this.field = value assignments
        // IL AST uses ThisPropertyAccess for this.X patterns
        const isThisAssignment = stmt.type === 'ExpressionStatement' &&
          stmt.expression?.type === 'AssignmentExpression' &&
          stmt.expression.operator === '=' &&
          (stmt.expression.left?.type === 'ThisPropertyAccess' ||
           stmt.expression.left?.ilNodeType === 'ThisPropertyAccess' ||
           (stmt.expression.left?.type === 'MemberExpression' &&
            stmt.expression.left?.object?.type === 'ThisExpression'));

        if (!isThisAssignment) continue;

        let fieldName;
        if (stmt.expression.left.type === 'ThisPropertyAccess' ||
            stmt.expression.left.ilNodeType === 'ThisPropertyAccess') {
          fieldName = stmt.expression.left.property;
        } else {
          fieldName = stmt.expression.left.property?.name ||
                     stmt.expression.left.property?.value;
        }

        if (!fieldName || seenFields.has(fieldName)) continue;
        seenFields.add(fieldName);

        // Infer type from the assigned value
        let fieldType = this.inferExpressionType(stmt.expression.right);

        // Also apply name-based overrides for crypto patterns
        const lowerName = fieldName.toLowerCase();

        // List fields that use Arrays.asList() in assignment - must be List<T> type
        const listFieldNames = ['documentation', 'references', 'knownvulnerabilities',
                               'tests', 'supportedkeysizes', 'supportedblocksizes'];

        if (listFieldNames.includes(lowerName)) {
          // These fields get assigned Arrays.asList(...), so type must be List<T>
          // Extract element type from array type if present
          let elementType = JavaType.Object();
          if (fieldType.name === 'Array' && fieldType.elementType) {
            elementType = fieldType.elementType;
          } else if (lowerName === 'documentation' || lowerName === 'references') {
            elementType = new JavaType('LinkItem');
          } else if (lowerName === 'knownvulnerabilities') {
            elementType = new JavaType('Vulnerability');
          } else if (lowerName === 'tests') {
            elementType = new JavaType('TestCase');
          } else if (lowerName === 'supportedkeysizes' || lowerName === 'supportedblocksizes') {
            elementType = new JavaType('KeySize');
          }
          fieldType = JavaType.List(elementType);
        } else if (lowerName.startsWith('is') || lowerName.startsWith('has') ||
            lowerName === 'inverse' || lowerName.includes('flag')) {
          fieldType = JavaType.Boolean();
        } else if (lowerName.includes('key') || lowerName.includes('data') ||
                   lowerName.includes('buffer') || lowerName.includes('block') ||
                   lowerName.includes('input') || lowerName.includes('output')) {
          fieldType = JavaType.Array(JavaType.Byte());
        } else if (lowerName.includes('size') || lowerName.includes('length') ||
                   lowerName === 'rounds' || lowerName === 'delta') {
          fieldType = JavaType.Int();
        }

        const field = new JavaField(fieldName, fieldType);
        field.accessModifier = 'private';
        fields.push(field);
      }

      return fields;
    }

    /**
     * Transform parameter
     */
    transformParameter(node) {
      const name = node.name || node.id?.name || 'param';
      const type = this.inferParameterType(name);
      return new JavaParameter(name, type);
    }

    /**
     * Transform PropertyDefinition to JavaField
     */
    transformPropertyDefinition(node) {
      const name = node.key.name;
      const type = this.inferPropertyType(node);
      const field = new JavaField(name, type);

      if (node.value) {
        field.initializer = this.transformExpression(node.value);
      }

      return field;
    }

    /**
     * Transform StaticBlock to Java static initializer
     */
    transformStaticBlock(node) {
      // ES2022 static { code } -> Java static { code }
      const statements = node.body.map(stmt => this.transformStatement(stmt));

      // Create a static initializer block (represented as a special method-like structure)
      const staticInit = new JavaMethod('', 'void');
      staticInit.isStatic = true;
      staticInit.isStaticInitializer = true; // Mark this as a static initializer
      staticInit.body = statements;

      return staticInit;
    }

    transformClassExpression(node) {
      // ClassExpression -> Java class (anonymous classes would need new BaseClass() { })
      const className = node.id?.name || 'AnonymousClass';
      const classDecl = new JavaClass(className);

      if (node.superClass)
        classDecl.extendsClass = this.transformExpression(node.superClass);

      if (node.body?.body) {
        for (const member of node.body.body) {
          if (member.type === 'MethodDefinition') {
            const method = this.transformMethodDefinition(member);
            if (method)
              classDecl.members.push(method);
          } else if (member.type === 'PropertyDefinition') {
            const field = this.transformPropertyDefinition(member);
            if (field)
              classDecl.members.push(field);
          }
        }
      }

      return classDecl;
    }

    transformYieldExpression(node) {
      // Java doesn't have yield in the same sense - return the argument
      // For iterator pattern, this would need to be refactored
      this.warnings.push('Java does not support yield expressions directly');
      return node.argument ? this.transformExpression(node.argument) : new JavaIdentifier('null');
    }

    /**
     * Transform VariableDeclaration to JavaField[] or JavaVariableDeclaration[]
     */
    transformVariableDeclaration(node, isField = false) {
      const results = [];

      for (const declarator of node.declarations) {
        // Skip ObjectPattern destructuring (e.g., const { RegisterAlgorithm } = AlgorithmFramework)
        if (declarator.id.type === 'ObjectPattern')
          continue;

        // Handle array destructuring: const [a, b, c] = arr;
        if (declarator.id.type === 'ArrayPattern') {
          const sourceExpr = declarator.init ? this.transformExpression(declarator.init) : null;
          if (sourceExpr) {
            for (let i = 0; i < declarator.id.elements.length; ++i) {
              const elem = declarator.id.elements[i];
              if (!elem) continue; // Skip holes in destructuring

              const varName = this.sanitizeName(elem.name);
              const indexExpr = new JavaArrayAccess(sourceExpr, JavaLiteral.Int(i));
              const varType = new JavaType('var');

              if (isField) {
                const field = new JavaField(varName, varType);
                field.initializer = indexExpr;
                field.isStatic = true;
                results.push(field);
              } else {
                const varDecl = new JavaVariableDeclaration(varName, varType);
                varDecl.initializer = indexExpr;
                this.variableTypes.set(varName, varType);
                results.push(varDecl);
              }
            }
          }
          continue;
        }

        const name = this.sanitizeName(declarator.id.name);
        const type = this.inferVariableType(declarator);

        // Check if this is an IIFE (immediately invoked function expression)
        let initExpr = null;
        if (declarator.init) {
          if (declarator.init.type === 'CallExpression' &&
              (declarator.init.callee.type === 'FunctionExpression' ||
               declarator.init.callee.type === 'ArrowFunctionExpression')) {
            // Extract return value from IIFE
            const returnValue = this.getIIFEReturnValue(declarator.init);
            if (returnValue)
              initExpr = this.transformExpression(returnValue);
          } else {
            initExpr = this.transformExpression(declarator.init);
          }
        }

        if (isField) {
          const field = new JavaField(name, type);
          field.initializer = initExpr;
          field.isStatic = true; // Top-level variables are static
          results.push(field);
        } else {
          const varDecl = new JavaVariableDeclaration(name, type);
          varDecl.initializer = initExpr;
          // Track variable type
          this.variableTypes.set(name, type);
          results.push(varDecl);
        }
      }

      return results;
    }

    /**
     * Transform BlockStatement
     */
    transformBlockStatement(node) {
      const block = new JavaBlock();

      for (const stmt of node.body) {
        const transformed = this.transformStatement(stmt);
        if (Array.isArray(transformed)) {
          block.statements.push(...transformed);
        } else if (transformed) {
          block.statements.push(transformed);
        }
      }

      return block;
    }

    /**
     * Transform any statement
     */
    transformStatement(node) {
      if (!node) return null;

      switch (node.type) {
        case 'BlockStatement':
          return this.transformBlockStatement(node);
        case 'VariableDeclaration':
          return this.transformVariableDeclaration(node, false);
        case 'ExpressionStatement':
          return new JavaExpressionStatement(this.transformExpression(node.expression));
        case 'ReturnStatement':
          return new JavaReturn(node.argument ? this.transformExpression(node.argument) : null);
        case 'IfStatement':
          return this.transformIfStatement(node);
        case 'ForStatement':
          return this.transformForStatement(node);
        case 'ForInStatement':
        case 'ForOfStatement':
          return this.transformForOfStatement(node);
        case 'WhileStatement':
          return this.transformWhileStatement(node);
        case 'DoWhileStatement':
          return this.transformDoWhileStatement(node);
        case 'SwitchStatement':
          return this.transformSwitchStatement(node);
        case 'BreakStatement':
          return new JavaBreak();
        case 'ContinueStatement':
          return new JavaContinue();
        case 'ThrowStatement':
          return new JavaThrow(this.transformExpression(node.argument));
        case 'TryStatement':
          return this.transformTryStatement(node);
        case 'ClassDeclaration':
          return this.transformClassDeclaration(node);
        case 'FunctionDeclaration':
          return this.transformFunctionDeclaration(node);
        default:
          this.warnings.push(`Unsupported statement type: ${node.type}`);
          return null;
      }
    }

    transformIfStatement(node) {
      const condition = this.transformExpression(node.test);
      const thenBranch = this.transformStatement(node.consequent);
      const elseBranch = node.alternate ? this.transformStatement(node.alternate) : null;
      return new JavaIf(condition, thenBranch, elseBranch);
    }

    transformForStatement(node) {
      const forLoop = new JavaFor();

      if (node.init) {
        if (node.init.type === 'VariableDeclaration') {
          const decls = this.transformVariableDeclaration(node.init, false);
          forLoop.initializer = decls[0]; // Take first declaration
        } else {
          forLoop.initializer = this.transformExpression(node.init);
        }
      }

      if (node.test) {
        forLoop.condition = this.transformExpression(node.test);
      }

      if (node.update) {
        forLoop.incrementor = this.transformExpression(node.update);
      }

      forLoop.body = this.transformStatement(node.body);
      if (forLoop.body.nodeType !== 'Block') {
        const block = new JavaBlock();
        block.statements.push(forLoop.body);
        forLoop.body = block;
      }

      return forLoop;
    }

    transformForOfStatement(node) {
      const rawName = node.left.declarations ? node.left.declarations[0].id.name : node.left.name;
      const varName = this.sanitizeName(rawName);
      const varType = this.inferVariableType(node.left);
      const iterable = this.transformExpression(node.right);
      const body = this.transformStatement(node.body);

      const bodyBlock = body.nodeType === 'Block' ? body : (() => {
        const block = new JavaBlock();
        block.statements.push(body);
        return block;
      })();

      return new JavaForEach(varName, varType, iterable, bodyBlock);
    }

    transformWhileStatement(node) {
      const condition = this.transformExpression(node.test);
      const body = this.transformStatement(node.body);

      const bodyBlock = body.nodeType === 'Block' ? body : (() => {
        const block = new JavaBlock();
        block.statements.push(body);
        return block;
      })();

      return new JavaWhile(condition, bodyBlock);
    }

    transformDoWhileStatement(node) {
      const body = this.transformStatement(node.body);
      const condition = this.transformExpression(node.test);

      const bodyBlock = body.nodeType === 'Block' ? body : (() => {
        const block = new JavaBlock();
        block.statements.push(body);
        return block;
      })();

      return new JavaDoWhile(bodyBlock, condition);
    }

    transformSwitchStatement(node) {
      const discriminant = this.transformExpression(node.discriminant);
      const switchStmt = new JavaSwitch(discriminant);

      for (const caseNode of node.cases) {
        const javaCase = new JavaSwitchCase(
          caseNode.test ? this.transformExpression(caseNode.test) : null
        );

        for (const stmt of caseNode.consequent) {
          const transformed = this.transformStatement(stmt);
          if (Array.isArray(transformed)) {
            javaCase.statements.push(...transformed);
          } else if (transformed) {
            javaCase.statements.push(transformed);
          }
        }

        switchStmt.cases.push(javaCase);
      }

      return switchStmt;
    }

    transformTryStatement(node) {
      const tryStmt = new JavaTryCatch();
      tryStmt.tryBlock = this.transformBlockStatement(node.block);

      if (node.handler) {
        const exType = JavaType.Object(); // Could be more specific
        const exName = node.handler.param ? node.handler.param.name : 'e';
        const catchBody = this.transformBlockStatement(node.handler.body);
        tryStmt.catchClauses.push(new JavaCatchClause(exType, exName, catchBody));
      }

      if (node.finalizer) {
        tryStmt.finallyBlock = this.transformBlockStatement(node.finalizer);
      }

      return tryStmt;
    }

    /**
     * Transform any expression
     */
    transformExpression(node) {
      if (!node) return null;

      switch (node.type) {
        case 'Literal':
          return this.transformLiteral(node);
        case 'Identifier':
          return this.transformIdentifier(node);
        case 'BinaryExpression':
          return this.transformBinaryExpression(node);
        case 'LogicalExpression':
          return this.transformBinaryExpression(node); // Same handling
        case 'UnaryExpression':
          return this.transformUnaryExpression(node);
        case 'UpdateExpression':
          return this.transformUpdateExpression(node);
        case 'AssignmentExpression':
          return this.transformAssignmentExpression(node);
        case 'MemberExpression':
          return this.transformMemberExpression(node);
        case 'CallExpression':
          return this.transformCallExpression(node);
        case 'NewExpression':
          return this.transformNewExpression(node);
        case 'ArrayExpression':
          return this.transformArrayExpression(node);
        case 'ObjectExpression':
          return this.transformObjectExpression(node);
        case 'ConditionalExpression':
          return this.transformConditionalExpression(node);
        case 'ThisExpression':
          return new JavaThis();
        case 'Super':
          return new JavaSuper();
        case 'ArrowFunctionExpression':
        case 'FunctionExpression':
          return this.transformLambdaExpression(node);
        case 'SequenceExpression':
          // Return last expression (comma operator)
          return this.transformExpression(node.expressions[node.expressions.length - 1]);
        case 'SpreadElement':
          // Spread in arrays/calls
          return this.transformExpression(node.argument);
        case 'TemplateLiteral':
          // `Hello ${name}!` -> "Hello " + name + "!"
          return this.transformTemplateLiteral(node);
        case 'ObjectPattern':
          // Object destructuring - Java doesn't support this directly
          // Return a comment placeholder
          return new JavaIdentifier('/* Object destructuring not supported in Java */');

        case 'StaticBlock':
          return this.transformStaticBlock(node);

        case 'ChainExpression':
          // Optional chaining a?.b - Java doesn't have this, transform inner expression
          return this.transformExpression(node.expression);

        case 'ClassExpression':
          // Anonymous class expression
          return this.transformClassExpression(node);

        case 'YieldExpression':
          // yield - Java doesn't have generators, return the argument
          return this.transformYieldExpression(node);

        case 'PrivateIdentifier':
          // #field -> Java private field (just use the name, access modifier handled elsewhere)
          return new JavaIdentifier('_' + node.name);

        // IL AST node types from type-aware-transpiler
        case 'ThisPropertyAccess':
          // this.property -> this.property in Java
          // node.property is already the property name string from IL AST
          // Convert to camelCase for Java naming convention
          return new JavaMemberAccess(new JavaThis(), this.toCamelCase(node.property));

        case 'ThisMethodCall':
          // this.method(args) -> this.method(args) in Java
          {
            const args = (node.arguments || []).map(a => this.transformExpression(a));
            return new JavaMethodCall(new JavaThis(), node.method, args);
          }

        case 'ParentConstructorCall':
          // super() with optional args
          if (node.arguments && node.arguments.length > 0) {
            const args = node.arguments.map(a => this.transformExpression(a));
            return new JavaMethodCall(new JavaSuper(), null, args);
          }
          return new JavaMethodCall(new JavaSuper(), null, []);

        case 'ArrayLength':
          // array.length in Java
          return new JavaMemberAccess(this.transformExpression(node.array), 'length');

        case 'BigIntCast':
          // BigInt(x) -> BigInteger.valueOf(x) for primitives
          if (node.argument) {
            const arg = this.transformExpression(node.argument);
            return new JavaMethodCall(new JavaIdentifier('BigInteger'), 'valueOf', [arg]);
          }
          return new JavaMethodCall(new JavaIdentifier('BigInteger'), 'valueOf', [JavaLiteral.Int(0)]);

        case 'ArrayCreation':
          // new Array(size) -> new Object[size]
          {
            const size = node.size ? this.transformExpression(node.size) : JavaLiteral.Int(0);
            return new JavaArrayCreation('Object', size);
          }

        case 'TypedArrayCreation':
          // new Uint8Array(size) -> new byte[size], etc.
          {
            const size = node.size ? this.transformExpression(node.size) : JavaLiteral.Int(0);
            const typeMap = {
              'Uint8Array': 'byte', 'Int8Array': 'byte',
              'Uint16Array': 'short', 'Int16Array': 'short',
              'Uint32Array': 'int', 'Int32Array': 'int',
              'Uint64Array': 'long', 'Int64Array': 'long',
              'Float32Array': 'float', 'Float64Array': 'double'
            };
            const javaType = typeMap[node.arrayType] || 'int';
            return new JavaArrayCreation(javaType, size);
          }

        case 'HexDecode':
          // Hex.decode(str) helper - IL nodes have arguments array
          return new JavaMethodCall(new JavaIdentifier('Hex'), 'decode', [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'HexEncode':
          // Hex.encode(bytes) helper - IL nodes have arguments array
          return new JavaMethodCall(new JavaIdentifier('Hex'), 'encode', [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Rotation':
          // Bitwise rotation
          {
            const value = this.transformExpression(node.value);
            const amount = this.transformExpression(node.amount);
            const bits = node.bits || 32;
            const mask = bits === 32 ? '0xFFFFFFFF' : (bits === 64 ? '0xFFFFFFFFFFFFFFFFL' : '0xFF');
            if (node.direction === 'left') {
              return new JavaBinaryExpression(
                new JavaBinaryExpression(value, '<<', amount),
                '|',
                new JavaBinaryExpression(value, '>>>', new JavaBinaryExpression(JavaLiteral.Int(bits), '-', amount))
              );
            } else {
              return new JavaBinaryExpression(
                new JavaBinaryExpression(value, '>>>', amount),
                '|',
                new JavaBinaryExpression(value, '<<', new JavaBinaryExpression(JavaLiteral.Int(bits), '-', amount))
              );
            }
          }

        case 'PackBytes': {
          // Pack bytes to integer - IL nodes have arguments array
          const args = node.arguments || node.bytes || [];
          const bytes = args.map(arg => {
            if (arg.type === 'SpreadElement') {
              return this.transformExpression(arg.argument);
            }
            return this.transformExpression(arg);
          });
          const isBE = node.endian === 'big' || node.bigEndian;
          const bits = node.bits || 32;
          const methodName = `pack${bits}${isBE ? 'BE' : 'LE'}`;
          return new JavaMethodCall(new JavaIdentifier('BytePacker'), methodName, bytes);
        }

        case 'UnpackBytes': {
          // Unpack integer to bytes - IL nodes have arguments array
          const value = this.transformExpression(node.arguments?.[0] || node.value);
          const isBE = node.endian === 'big' || node.bigEndian;
          const bits = node.bits || 32;
          const methodName = `unpack${bits}${isBE ? 'BE' : 'LE'}`;
          return new JavaMethodCall(new JavaIdentifier('BytePacker'), methodName, [value]);
        }

        case 'Floor':
          return new JavaMethodCall(new JavaIdentifier('Math'), 'floor', [this.transformExpression(node.value)]);

        case 'Ceil':
          return new JavaMethodCall(new JavaIdentifier('Math'), 'ceil', [this.transformExpression(node.value)]);

        case 'Abs':
          return new JavaMethodCall(new JavaIdentifier('Math'), 'abs', [this.transformExpression(node.value)]);

        case 'Min':
          return new JavaMethodCall(new JavaIdentifier('Math'), 'min', (node.values || []).map(v => this.transformExpression(v)));

        case 'Max':
          return new JavaMethodCall(new JavaIdentifier('Math'), 'max', (node.values || []).map(v => this.transformExpression(v)));

        case 'Pow':
          return new JavaMethodCall(new JavaIdentifier('Math'), 'pow', [
            this.transformExpression(node.base),
            this.transformExpression(node.exponent)
          ]);

        case 'Sqrt':
          return new JavaMethodCall(new JavaIdentifier('Math'), 'sqrt', [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Cbrt':
          return new JavaMethodCall(new JavaIdentifier('Math'), 'cbrt', [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Log':
          return new JavaMethodCall(new JavaIdentifier('Math'), 'log', [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Log2':
          // Java doesn't have Math.log2, use Math.log(x) / Math.log(2)
          return new JavaBinaryExpression(
            new JavaMethodCall(new JavaIdentifier('Math'), 'log', [this.transformExpression(node.arguments?.[0] || node.value)]),
            '/',
            new JavaMethodCall(new JavaIdentifier('Math'), 'log', [JavaLiteral.Double(2.0)])
          );

        case 'Log10':
          return new JavaMethodCall(new JavaIdentifier('Math'), 'log10', [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Exp':
          return new JavaMethodCall(new JavaIdentifier('Math'), 'exp', [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Round':
          return new JavaMethodCall(new JavaIdentifier('Math'), 'round', [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Trunc':
          return new JavaCast(new JavaType('long'), this.transformExpression(node.arguments?.[0] || node.value));

        case 'Sign':
          return new JavaMethodCall(new JavaIdentifier('Math'), 'signum', [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Sin':
          return new JavaMethodCall(new JavaIdentifier('Math'), 'sin', [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Cos':
          return new JavaMethodCall(new JavaIdentifier('Math'), 'cos', [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Tan':
          return new JavaMethodCall(new JavaIdentifier('Math'), 'tan', [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Asin':
          return new JavaMethodCall(new JavaIdentifier('Math'), 'asin', [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Acos':
          return new JavaMethodCall(new JavaIdentifier('Math'), 'acos', [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Atan':
          return new JavaMethodCall(new JavaIdentifier('Math'), 'atan', [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Atan2': {
          const y = this.transformExpression(node.arguments?.[0] || node.y);
          const x = this.transformExpression(node.arguments?.[1] || node.x);
          return new JavaMethodCall(new JavaIdentifier('Math'), 'atan2', [y, x]);
        }

        case 'Sinh':
          return new JavaMethodCall(new JavaIdentifier('Math'), 'sinh', [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Cosh':
          return new JavaMethodCall(new JavaIdentifier('Math'), 'cosh', [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Tanh':
          return new JavaMethodCall(new JavaIdentifier('Math'), 'tanh', [this.transformExpression(node.arguments?.[0] || node.value)]);

        case 'Hypot': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          return new JavaMethodCall(new JavaIdentifier('Math'), 'hypot', args);
        }

        case 'Fround':
          return new JavaCast(new JavaType('float'), this.transformExpression(node.arguments?.[0] || node.value));

        case 'MathCall': {
          const method = node.method;
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          if (method === 'imul') {
            // Math.imul(a, b) -> (int)(a * b) in Java
            if (args.length >= 2)
              return new JavaCast(new JavaType('int'), new JavaBinaryExpression(args[0], '*', args[1]));
          }
          // Default: use Math.method(args...)
          return new JavaMethodCall(new JavaIdentifier('Math'), method, args);
        }

        case 'MathConstant': {
          switch (node.name) {
            case 'PI': return new JavaMemberAccess(new JavaIdentifier('Math'), 'PI');
            case 'E': return new JavaMemberAccess(new JavaIdentifier('Math'), 'E');
            case 'LN2': return new JavaMethodCall(new JavaIdentifier('Math'), 'log', [JavaLiteral.Double(2.0)]);
            case 'LN10': return new JavaMethodCall(new JavaIdentifier('Math'), 'log', [JavaLiteral.Double(10.0)]);
            case 'LOG2E': return new JavaBinaryExpression(JavaLiteral.Double(1.0), '/', new JavaMethodCall(new JavaIdentifier('Math'), 'log', [JavaLiteral.Double(2.0)]));
            case 'LOG10E': return new JavaMethodCall(new JavaIdentifier('Math'), 'log10', [new JavaMemberAccess(new JavaIdentifier('Math'), 'E')]);
            case 'SQRT2': return new JavaMethodCall(new JavaIdentifier('Math'), 'sqrt', [JavaLiteral.Double(2.0)]);
            case 'SQRT1_2': return new JavaMethodCall(new JavaIdentifier('Math'), 'sqrt', [JavaLiteral.Double(0.5)]);
            default: return JavaLiteral.Double(node.value);
          }
        }

        case 'NumberConstant': {
          switch (node.name) {
            case 'MAX_SAFE_INTEGER': return new JavaMemberAccess(new JavaIdentifier('Long'), 'MAX_VALUE');
            case 'MIN_SAFE_INTEGER': return new JavaMemberAccess(new JavaIdentifier('Long'), 'MIN_VALUE');
            case 'MAX_VALUE': return new JavaMemberAccess(new JavaIdentifier('Double'), 'MAX_VALUE');
            case 'MIN_VALUE': return new JavaMemberAccess(new JavaIdentifier('Double'), 'MIN_VALUE');
            case 'POSITIVE_INFINITY': return new JavaMemberAccess(new JavaIdentifier('Double'), 'POSITIVE_INFINITY');
            case 'NEGATIVE_INFINITY': return new JavaMemberAccess(new JavaIdentifier('Double'), 'NEGATIVE_INFINITY');
            case 'NaN': return new JavaMemberAccess(new JavaIdentifier('Double'), 'NaN');
            case 'EPSILON': return new JavaMemberAccess(new JavaIdentifier('Double'), 'MIN_NORMAL');
            default: return JavaLiteral.Double(node.value);
          }
        }

        case 'InstanceOfCheck': {
          const value = this.transformExpression(node.value);
          const className = typeof node.className === 'string' ? new JavaIdentifier(node.className) : this.transformExpression(node.className);
          return new JavaBinaryExpression(value, 'instanceof', className);
        }

        case 'ArraySlice':
          // array.slice(start, end) -> Arrays.copyOfRange(array, start, end)
          {
            this.addImport('java.util.Arrays');
            const arr = this.transformExpression(node.array);
            const start = node.start ? this.transformExpression(node.start) : JavaLiteral.Int(0);
            const end = node.end ? this.transformExpression(node.end) : new JavaMemberAccess(arr, 'length');
            return new JavaMethodCall(new JavaIdentifier('Arrays'), 'copyOfRange', [arr, start, end]);
          }

        case 'ArrayAppend':
          // array.push(value) -> need ArrayList or manual array expansion
          // For simplicity, use a helper method call
          {
            const arr = this.transformExpression(node.array);
            const value = this.transformExpression(node.value);
            // This would need ArrayList for proper implementation
            this.warnings.push('ArrayAppend needs ArrayList for proper Java implementation');
            return new JavaMethodCall(arr, 'add', [value]);
          }

        case 'ArrayConcat':
          // arr1.concat(arr2) -> ArrayUtils.addAll(arr1, arr2)
          {
            const arr1 = this.transformExpression(node.array);
            const arr2 = this.transformExpression(node.other);
            return new JavaMethodCall(new JavaIdentifier('ArrayUtils'), 'addAll', [arr1, arr2]);
          }

        case 'ArrayFill':
          // Arrays.fill(arr, value)
          {
            this.addImport('java.util.Arrays');
            const arr = this.transformExpression(node.array);
            const value = this.transformExpression(node.value);
            return new JavaMethodCall(new JavaIdentifier('Arrays'), 'fill', [arr, value]);
          }

        case 'ErrorCreation':
          // new Error("message") -> new RuntimeException("message")
          {
            const errorType = node.errorType === 'TypeError' ? 'IllegalArgumentException' :
                             node.errorType === 'RangeError' ? 'IndexOutOfBoundsException' :
                             'RuntimeException';
            const message = node.message ? this.transformExpression(node.message) : JavaLiteral.String('');
            return new JavaObjectCreation(new JavaType(errorType), [message]);
          }

        case 'ArraySplice':
          // array.splice(start, deleteCount, items...) -> manual array manipulation
          {
            this.warnings.push('ArraySplice requires manual array manipulation in Java');
            const arr = node.array ? this.transformExpression(node.array) : new JavaIdentifier('array');
            const spliceArgs = [];
            if (node.start) spliceArgs.push(this.transformExpression(node.start));
            if (node.deleteCount) spliceArgs.push(this.transformExpression(node.deleteCount));
            if (node.items) {
              for (const item of node.items)
                spliceArgs.push(this.transformExpression(item));
            }
            return new JavaMethodCall(arr, 'splice', spliceArgs);
          }

        case 'StringCharAt':
          // str.charAt(index) -> str.charAt(index)
          {
            const str = this.transformExpression(node.string);
            const index = this.transformExpression(node.index);
            return new JavaMethodCall(str, 'charAt', [index]);
          }

        case 'StringCharCodeAt':
          // str.charCodeAt(index) -> (int)str.charAt(index)
          {
            const str = this.transformExpression(node.string);
            const index = this.transformExpression(node.index);
            return new JavaCast(new JavaType('int'), new JavaMethodCall(str, 'charAt', [index]));
          }

        case 'StringFromCharCode':
          // String.fromCharCode(code) -> String.valueOf((char)code)
          {
            const code = this.transformExpression(node.code);
            return new JavaMethodCall(new JavaIdentifier('String'), 'valueOf', [
              new JavaCast(new JavaType('char'), code)
            ]);
          }

        case 'Cast':
          // Type cast from OpCodes like ToUint32, ToUint8, ToInt32
          {
            const value = node.value ? this.transformExpression(node.value) :
                         node.argument ? this.transformExpression(node.argument) :
                         node.arguments?.[0] ? this.transformExpression(node.arguments[0]) :
                         JavaLiteral.Int(0);
            const targetType = node.targetType || 'int';
            const javaType = this.mapType(targetType);
            // For unsigned types, we might need masking
            if (targetType === 'uint32' || targetType === 'dword') {
              return new JavaBinaryExpression(new JavaCast(new JavaType('int'), value), '&', new JavaIdentifier('0xFFFFFFFF'));
            } else if (targetType === 'uint8' || targetType === 'byte') {
              return new JavaBinaryExpression(new JavaCast(new JavaType('int'), value), '&', JavaLiteral.Int(0xFF));
            } else if (targetType === 'uint16' || targetType === 'word') {
              return new JavaBinaryExpression(new JavaCast(new JavaType('int'), value), '&', JavaLiteral.Int(0xFFFF));
            }
            return new JavaCast(new JavaType(javaType), value);
          }

        case 'StringToBytes':
          // Convert string to bytes with specified encoding
          {
            const str = node.value ? this.transformExpression(node.value) :
                       node.argument ? this.transformExpression(node.argument) :
                       JavaLiteral.String('');
            const encoding = node.encoding === 'utf8' ? 'UTF-8' : 'US-ASCII';
            return new JavaMethodCall(str, 'getBytes', [JavaLiteral.String(encoding)]);
          }

        case 'BytesToString':
          // Convert bytes to string with specified encoding
          {
            const bytes = node.value ? this.transformExpression(node.value) :
                         node.argument ? this.transformExpression(node.argument) :
                         new JavaArrayCreation('byte', JavaLiteral.Int(0));
            const encoding = node.encoding === 'utf8' ? 'UTF-8' : 'US-ASCII';
            return new JavaObjectCreation(new JavaType('String'), [bytes, JavaLiteral.String(encoding)]);
          }

        case 'ArrayClear':
          // OpCodes.ClearArray(arr) -> Arrays.fill(arr, 0) or Arrays.fill(arr, (byte)0)
          {
            this.addImport('java.util.Arrays');
            const arr = node.arguments?.[0] ? this.transformExpression(node.arguments[0]) : new JavaIdentifier('array');
            return new JavaMethodCall(new JavaIdentifier('Arrays'), 'fill', [arr, JavaLiteral.Int(0)]);
          }

        case 'ArraySome':
          // array.some(predicate) -> Arrays.stream(array).anyMatch(predicate)
          // For simple length check predicates, we inline them
          {
            this.addImport('java.util.Arrays');
            const arr = node.array ? this.transformExpression(node.array) : new JavaIdentifier('array');
            const callback = node.callback || node.predicate;
            // Generate a lambda expression for the predicate
            if (callback && callback.type === 'ArrowFunctionExpression') {
              const param = callback.params?.[0]?.name || 'e';
              const body = this.transformExpression(callback.body);
              const lambda = new JavaLambda([param], body);
              return new JavaMethodCall(
                new JavaMethodCall(new JavaIdentifier('Arrays'), 'stream', [arr]),
                'anyMatch',
                [lambda]
              );
            }
            // Fallback: generate comment
            return new JavaMethodCall(new JavaIdentifier('Arrays'), 'stream', [arr]);
          }

        case 'ArrayIncludes':
          // array.includes(value) -> Arrays.asList(array).contains(value) or loop
          {
            this.addImport('java.util.Arrays');
            const arr = node.array ? this.transformExpression(node.array) : new JavaIdentifier('array');
            const value = node.value ? this.transformExpression(node.value) : JavaLiteral.Null();
            // For primitive arrays, we need to loop; for Object arrays, use Arrays.asList
            return new JavaMethodCall(
              new JavaMethodCall(new JavaIdentifier('Arrays'), 'asList', [arr]),
              'contains',
              [value]
            );
          }

        case 'ArrayJoin':
          // array.join(sep) -> String.join(sep, array) or Arrays.toString
          {
            const arr = node.array ? this.transformExpression(node.array) : new JavaIdentifier('array');
            const sep = node.separator ? this.transformExpression(node.separator) : JavaLiteral.String(',');
            return new JavaMethodCall(new JavaIdentifier('String'), 'join', [sep, arr]);
          }

        case 'ArrayLiteral':
          // [a, b, c] -> new T[] { a, b, c } with proper type inference
          {
            const elements = (node.elements || []).map(e => this.transformExpression(e));
            // Determine element type from IL node, first element, or default
            let elementType = 'int';

            // Use IL's elementType if available and map it to Java
            if (node.elementType) {
              const ilTypeMap = {
                'int8': 'byte', 'uint8': 'byte', 'int16': 'short', 'uint16': 'short',
                'int32': 'int', 'uint32': 'int', 'int64': 'long', 'uint64': 'long',
                'float32': 'float', 'float64': 'double', 'string': 'String',
                'boolean': 'boolean', 'object': 'Object'
              };
              elementType = ilTypeMap[node.elementType] || node.elementType;
            }

            // Override with more specific type from first element
            if (node.elements && node.elements.length > 0) {
              const firstEl = node.elements[0];
              if (firstEl) {
                if (firstEl.type === 'Literal' && typeof firstEl.value === 'string') {
                  elementType = 'String';
                } else if (firstEl.type === 'ArrayLiteral' || firstEl.type === 'ArrayExpression') {
                  elementType = 'int[]';
                } else if (firstEl.type === 'NewExpression' || firstEl.type === 'ObjectCreation') {
                  // Extract type from object creation: new ClassName(...) -> ClassName
                  const callee = firstEl.callee || firstEl.type;
                  if (callee && callee.name) {
                    elementType = callee.name;
                  } else if (firstEl.className) {
                    elementType = firstEl.className;
                  } else if (typeof callee === 'string') {
                    elementType = callee;
                  }
                } else if (firstEl.type === 'ObjectExpression') {
                  // Object literals -> HashMap
                  elementType = 'HashMap<String, Object>';
                  this.addImport('java.util.HashMap');
                }
              }
            }

            return new JavaArrayCreation(elementType, null, elements);
          }

        case 'OpCodesCall':
          // OpCodes.MethodName(args) -> Java equivalent
          {
            const methodName = node.methodName || node.method;
            const args = (node.arguments || []).map(a => this.transformExpression(a));
            return this.transformOpCodesCall(methodName, args);
          }

        case 'ArrayIndexOf':
          // array.indexOf(value) -> Arrays.asList(array).indexOf(value)
          {
            this.addImport('java.util.Arrays');
            const arr = node.array ? this.transformExpression(node.array) : new JavaIdentifier('array');
            const value = node.value ? this.transformExpression(node.value) : JavaLiteral.Null();
            return new JavaMethodCall(
              new JavaMethodCall(new JavaIdentifier('Arrays'), 'asList', [arr]),
              'indexOf',
              [value]
            );
          }

        case 'ArrayMap':
          // array.map(fn) -> Arrays.stream(array).map(fn).toArray()
          {
            this.addImport('java.util.Arrays');
            const arr = node.array ? this.transformExpression(node.array) : new JavaIdentifier('array');
            const callback = node.callback || node.fn;
            if (callback && callback.type === 'ArrowFunctionExpression') {
              const param = callback.params?.[0]?.name || 'e';
              const body = this.transformExpression(callback.body);
              const lambda = new JavaLambda([param], body);
              return new JavaMethodCall(
                new JavaMethodCall(
                  new JavaMethodCall(new JavaIdentifier('Arrays'), 'stream', [arr]),
                  'map',
                  [lambda]
                ),
                'toArray',
                []
              );
            }
            return new JavaMethodCall(new JavaIdentifier('Arrays'), 'stream', [arr]);
          }

        case 'ArrayFilter':
          // array.filter(fn) -> Arrays.stream(array).filter(fn).toArray()
          {
            this.addImport('java.util.Arrays');
            const arr = node.array ? this.transformExpression(node.array) : new JavaIdentifier('array');
            const callback = node.callback || node.predicate;
            if (callback && callback.type === 'ArrowFunctionExpression') {
              const param = callback.params?.[0]?.name || 'e';
              const body = this.transformExpression(callback.body);
              const lambda = new JavaLambda([param], body);
              return new JavaMethodCall(
                new JavaMethodCall(
                  new JavaMethodCall(new JavaIdentifier('Arrays'), 'stream', [arr]),
                  'filter',
                  [lambda]
                ),
                'toArray',
                []
              );
            }
            return new JavaMethodCall(new JavaIdentifier('Arrays'), 'stream', [arr]);
          }

        case 'RotateLeft':
          // OpCodes.RotL32(value, amount) -> Integer.rotateLeft(value, amount)
          // OpCodes.RotL64(value, amount) -> Long.rotateLeft(value, amount)
          {
            const value = this.transformExpression(node.value);
            const amount = this.transformExpression(node.amount);
            const bits = node.bits || 32;
            if (bits === 64) {
              return new JavaMethodCall(new JavaIdentifier('Long'), 'rotateLeft', [value, amount]);
            }
            return new JavaMethodCall(new JavaIdentifier('Integer'), 'rotateLeft', [value, amount]);
          }

        case 'RotateRight':
          // OpCodes.RotR32(value, amount) -> Integer.rotateRight(value, amount)
          // OpCodes.RotR64(value, amount) -> Long.rotateRight(value, amount)
          {
            const value = this.transformExpression(node.value);
            const amount = this.transformExpression(node.amount);
            const bits = node.bits || 32;
            if (bits === 64) {
              return new JavaMethodCall(new JavaIdentifier('Long'), 'rotateRight', [value, amount]);
            }
            return new JavaMethodCall(new JavaIdentifier('Integer'), 'rotateRight', [value, amount]);
          }

        // IL AST StringInterpolation - `Hello ${name}` -> "Hello " + name
        case 'StringInterpolation': {
          const parts = [];
          if (node.parts) {
            for (const part of node.parts) {
              if (part.type === 'StringPart' || part.ilNodeType === 'StringPart') {
                if (part.value)
                  parts.push(JavaLiteral.String(part.value));
              } else if (part.type === 'ExpressionPart' || part.ilNodeType === 'ExpressionPart') {
                parts.push(this.transformExpression(part.expression));
              }
            }
          }
          if (parts.length === 0) return JavaLiteral.String('');
          if (parts.length === 1) return parts[0];
          let result = parts[0];
          for (let i = 1; i < parts.length; ++i)
            result = new JavaBinaryExpression(result, '+', parts[i]);
          return result;
        }

        // IL AST ObjectLiteral - {key: value} -> Map.of(...) or new HashMap<>()
        case 'ObjectLiteral': {
          if (!node.properties || node.properties.length === 0)
            return new JavaMethodCall(new JavaIdentifier('Map'), 'of', []);
          const args = [];
          for (const prop of (node.properties || [])) {
            if (prop.type === 'SpreadElement') continue;
            const key = prop.key?.name || prop.key?.value || prop.key || 'key';
            args.push(JavaLiteral.String(key));
            args.push(this.transformExpression(prop.value));
          }
          return new JavaMethodCall(new JavaIdentifier('Map'), 'of', args);
        }

        // IL AST StringFromCharCodes - String.fromCharCode(65) -> Character.toString((char)65)
        case 'StringFromCharCodes': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          if (args.length === 0)
            return JavaLiteral.String('');
          if (args.length === 1) {
            return new JavaMethodCall(new JavaIdentifier('Character'), 'toString', [
              new JavaCast(JavaType.Char(), args[0])
            ]);
          }
          // Multiple: new String(new char[]{(char)c1, (char)c2, ...})
          const charArray = new JavaArrayInitializer(args.map(a => new JavaCast(JavaType.Char(), a)));
          return new JavaNewExpression(JavaType.String(), [charArray]);
        }

        // IL AST IsArrayCheck - Array.isArray(x) -> x != null && x.getClass().isArray()
        case 'IsArrayCheck': {
          const value = this.transformExpression(node.value);
          return new JavaBinaryExpression(
            new JavaBinaryExpression(value, '!=', JavaLiteral.Null()),
            '&&',
            new JavaMethodCall(new JavaMethodCall(value, 'getClass', []), 'isArray', [])
          );
        }

        // IL AST ArrowFunction - (x) => expr -> x -> expr
        case 'ArrowFunction': {
          const params = (node.params || []).map(p => {
            const name = typeof p === 'string' ? p : (p.name || 'arg');
            return name;
          });
          let body;
          if (node.body) {
            if (node.body.type === 'BlockStatement') {
              body = this.transformBlockStatement(node.body);
            } else {
              body = this.transformExpression(node.body);
            }
          } else {
            body = JavaLiteral.Null();
          }
          return new JavaLambda(params, body);
        }

        // IL AST TypeOfExpression - typeof x -> x.getClass().getName()
        case 'TypeOfExpression': {
          const value = this.transformExpression(node.value);
          return new JavaMethodCall(new JavaMethodCall(value, 'getClass', []), 'getName', []);
        }

        // IL AST Power - x ** y -> Math.pow(x, y)
        case 'Power': {
          const left = this.transformExpression(node.left);
          const right = this.transformExpression(node.right);
          return new JavaMethodCall(new JavaIdentifier('Math'), 'pow', [left, right]);
        }

        // IL AST ObjectFreeze - Object.freeze(x) -> just return x (no-op in Java)
        case 'ObjectFreeze': {
          return this.transformExpression(node.value);
        }

        // ========================[ Array Operations ]========================

        // IL AST ArrayEvery - array.every(predicate) -> Arrays.stream(array).allMatch(predicate)
        case 'ArrayEvery': {
          this.addImport('java.util.Arrays');
          const arr = node.array ? this.transformExpression(node.array) : new JavaIdentifier('array');
          const callback = node.callback || node.predicate;
          if (callback && (callback.type === 'ArrowFunctionExpression' || callback.type === 'ArrowFunction')) {
            const param = callback.params?.[0]?.name || callback.params?.[0] || 'e';
            const paramName = typeof param === 'string' ? param : param.name || 'e';
            const body = this.transformExpression(callback.body);
            const lambda = new JavaLambda([paramName], body);
            return new JavaMethodCall(
              new JavaMethodCall(new JavaIdentifier('Arrays'), 'stream', [arr]),
              'allMatch',
              [lambda]
            );
          }
          if (callback) {
            const callbackExpr = this.transformExpression(callback);
            return new JavaMethodCall(
              new JavaMethodCall(new JavaIdentifier('Arrays'), 'stream', [arr]),
              'allMatch',
              [callbackExpr]
            );
          }
          return new JavaMethodCall(new JavaIdentifier('Arrays'), 'stream', [arr]);
        }

        // IL AST ArrayFind - array.find(predicate) -> Arrays.stream(array).filter(predicate).findFirst().orElse(null)
        case 'ArrayFind': {
          this.addImport('java.util.Arrays');
          const arr = node.array ? this.transformExpression(node.array) : new JavaIdentifier('array');
          const callback = node.callback || node.predicate;
          if (callback && (callback.type === 'ArrowFunctionExpression' || callback.type === 'ArrowFunction')) {
            const param = callback.params?.[0]?.name || callback.params?.[0] || 'e';
            const paramName = typeof param === 'string' ? param : param.name || 'e';
            const body = this.transformExpression(callback.body);
            const lambda = new JavaLambda([paramName], body);
            return new JavaMethodCall(
              new JavaMethodCall(
                new JavaMethodCall(
                  new JavaMethodCall(new JavaIdentifier('Arrays'), 'stream', [arr]),
                  'filter',
                  [lambda]
                ),
                'findFirst',
                []
              ),
              'orElse',
              [JavaLiteral.Null()]
            );
          }
          if (callback) {
            const callbackExpr = this.transformExpression(callback);
            return new JavaMethodCall(
              new JavaMethodCall(
                new JavaMethodCall(
                  new JavaMethodCall(new JavaIdentifier('Arrays'), 'stream', [arr]),
                  'filter',
                  [callbackExpr]
                ),
                'findFirst',
                []
              ),
              'orElse',
              [JavaLiteral.Null()]
            );
          }
          return new JavaMethodCall(new JavaIdentifier('Arrays'), 'stream', [arr]);
        }

        // IL AST ArrayFindIndex - array.findIndex(predicate) -> IntStream.range(0, array.length).filter(i -> predicate(array[i])).findFirst().orElse(-1)
        case 'ArrayFindIndex': {
          this.addImport('java.util.stream.IntStream');
          const arr = node.array ? this.transformExpression(node.array) : new JavaIdentifier('array');
          const callback = node.callback || node.predicate;
          if (callback && (callback.type === 'ArrowFunctionExpression' || callback.type === 'ArrowFunction')) {
            const param = callback.params?.[0]?.name || callback.params?.[0] || 'e';
            const paramName = typeof param === 'string' ? param : param.name || 'e';
            const body = this.transformExpression(callback.body);
            // Build: IntStream.range(0, arr.length).filter(i -> predicate).findFirst().orElse(-1)
            const lambda = new JavaLambda([paramName], body);
            return new JavaMethodCall(
              new JavaMethodCall(
                new JavaMethodCall(
                  new JavaMethodCall(new JavaIdentifier('IntStream'), 'range', [JavaLiteral.Int(0), new JavaMemberAccess(arr, 'length')]),
                  'filter',
                  [lambda]
                ),
                'findFirst',
                []
              ),
              'orElse',
              [JavaLiteral.Int(-1)]
            );
          }
          this.warnings.push('ArrayFindIndex requires a lambda callback in Java');
          return new JavaIdentifier('/* ArrayFindIndex requires lambda */');
        }

        // IL AST ArrayForEach - array.forEach(callback) -> for (var item : array) { callback(item); }
        case 'ArrayForEach': {
          this.addImport('java.util.Arrays');
          const arr = node.array ? this.transformExpression(node.array) : new JavaIdentifier('array');
          const callback = node.callback;
          if (callback && (callback.type === 'ArrowFunctionExpression' || callback.type === 'ArrowFunction')) {
            const param = callback.params?.[0]?.name || callback.params?.[0] || 'e';
            const paramName = typeof param === 'string' ? param : param.name || 'e';
            const body = this.transformExpression(callback.body);
            const lambda = new JavaLambda([paramName], body);
            return new JavaMethodCall(
              new JavaMethodCall(new JavaIdentifier('Arrays'), 'stream', [arr]),
              'forEach',
              [lambda]
            );
          }
          if (callback) {
            const callbackExpr = this.transformExpression(callback);
            return new JavaMethodCall(
              new JavaMethodCall(new JavaIdentifier('Arrays'), 'stream', [arr]),
              'forEach',
              [callbackExpr]
            );
          }
          return new JavaMethodCall(new JavaIdentifier('Arrays'), 'stream', [arr]);
        }

        // IL AST ArrayFrom - Array.from(iterable) -> Arrays.copyOf(source, source.length) or stream-based
        case 'ArrayFrom': {
          this.addImport('java.util.Arrays');
          const source = this.transformExpression(node.iterable || node.value || node.argument || node.arguments?.[0]);
          if (node.mapFunction) {
            this.addImport('java.util.Arrays');
            const mapFn = this.transformExpression(node.mapFunction);
            return new JavaMethodCall(
              new JavaMethodCall(
                new JavaMethodCall(new JavaIdentifier('Arrays'), 'stream', [source]),
                'map',
                [mapFn]
              ),
              'toArray',
              []
            );
          }
          return new JavaMethodCall(source, 'clone', []);
        }

        // IL AST ArrayPop - array.pop() -> remove last element (requires ArrayList or manual)
        case 'ArrayPop': {
          const arr = node.array ? this.transformExpression(node.array) : new JavaIdentifier('array');
          this.warnings.push('ArrayPop requires ArrayList for proper Java implementation');
          return new JavaMethodCall(arr, 'remove', [
            new JavaBinaryExpression(new JavaMethodCall(arr, 'size', []), '-', JavaLiteral.Int(1))
          ]);
        }

        // IL AST ArrayReduce - array.reduce(callback, initial) -> Arrays.stream(array).reduce(identity, accumulator)
        case 'ArrayReduce': {
          this.addImport('java.util.Arrays');
          const arr = node.array ? this.transformExpression(node.array) : new JavaIdentifier('array');
          const callback = node.callback;
          const args = [];
          if (node.initialValue) args.push(this.transformExpression(node.initialValue));
          if (callback && (callback.type === 'ArrowFunctionExpression' || callback.type === 'ArrowFunction')) {
            const params = (callback.params || []).map(p => {
              const name = typeof p === 'string' ? p : (p.name || 'x');
              return name;
            });
            const body = this.transformExpression(callback.body);
            const lambda = new JavaLambda(params, body);
            args.push(lambda);
          } else if (callback) {
            args.push(this.transformExpression(callback));
          }
          return new JavaMethodCall(
            new JavaMethodCall(new JavaIdentifier('Arrays'), 'stream', [arr]),
            'reduce',
            args
          );
        }

        // IL AST ArrayReverse - array.reverse() -> Collections.reverse or manual loop
        case 'ArrayReverse': {
          this.addImport('java.util.Collections');
          this.addImport('java.util.Arrays');
          const arr = node.array ? this.transformExpression(node.array) : new JavaIdentifier('array');
          // Collections.reverse(Arrays.asList(arr)) - works for Object arrays
          // For primitive arrays, need manual implementation
          return new JavaMethodCall(new JavaIdentifier('Collections'), 'reverse', [
            new JavaMethodCall(new JavaIdentifier('Arrays'), 'asList', [arr])
          ]);
        }

        // IL AST ArrayShift - array.shift() -> remove first element (requires ArrayList or manual)
        case 'ArrayShift': {
          const arr = node.array ? this.transformExpression(node.array) : new JavaIdentifier('array');
          this.warnings.push('ArrayShift requires ArrayList for proper Java implementation');
          return new JavaMethodCall(arr, 'remove', [JavaLiteral.Int(0)]);
        }

        // IL AST ArraySort - array.sort(compareFn) -> Arrays.sort(array)
        case 'ArraySort': {
          this.addImport('java.util.Arrays');
          const arr = node.array ? this.transformExpression(node.array) : new JavaIdentifier('array');
          if (node.compareFn) {
            const compareFn = this.transformExpression(node.compareFn);
            return new JavaMethodCall(new JavaIdentifier('Arrays'), 'sort', [arr, compareFn]);
          }
          return new JavaMethodCall(new JavaIdentifier('Arrays'), 'sort', [arr]);
        }

        // IL AST ArrayUnshift - array.unshift(value) -> insert at beginning (requires ArrayList)
        case 'ArrayUnshift': {
          const arr = node.array ? this.transformExpression(node.array) : new JavaIdentifier('array');
          const value = node.value ? this.transformExpression(node.value) : JavaLiteral.Null();
          this.warnings.push('ArrayUnshift requires ArrayList for proper Java implementation');
          return new JavaMethodCall(arr, 'add', [JavaLiteral.Int(0), value]);
        }

        // IL AST ArrayXor - XOR two arrays element-wise
        case 'ArrayXor': {
          const arr1 = this.transformExpression(node.array1 || node.arguments?.[0]);
          const arr2 = this.transformExpression(node.array2 || node.arguments?.[1]);
          return this.createXorArraysCode(arr1, arr2);
        }

        // IL AST ClearArray - clear/zero an array -> Arrays.fill(arr, (byte)0)
        case 'ClearArray': {
          this.addImport('java.util.Arrays');
          const arr = node.array ? this.transformExpression(node.array) :
                     node.arguments?.[0] ? this.transformExpression(node.arguments[0]) :
                     new JavaIdentifier('array');
          return new JavaMethodCall(new JavaIdentifier('Arrays'), 'fill', [arr, JavaLiteral.Int(0)]);
        }

        // IL AST CopyArray - copy an array -> Arrays.copyOf(arr, arr.length) or arr.clone()
        case 'CopyArray': {
          this.addImport('java.util.Arrays');
          const arr = node.array ? this.transformExpression(node.array) :
                     node.arguments?.[0] ? this.transformExpression(node.arguments[0]) :
                     new JavaIdentifier('array');
          return new JavaMethodCall(arr, 'clone', []);
        }

        // ========================[ String Operations ]========================

        // IL AST StringEndsWith - str.endsWith(suffix) -> str.endsWith(suffix)
        case 'StringEndsWith': {
          const str = this.transformExpression(node.string || node.value);
          const suffix = this.transformExpression(node.suffix || node.search);
          return new JavaMethodCall(str, 'endsWith', [suffix]);
        }

        // IL AST StringIncludes - str.includes(sub) -> str.contains(sub)
        case 'StringIncludes': {
          const str = this.transformExpression(node.string || node.value);
          const search = this.transformExpression(node.search);
          return new JavaMethodCall(str, 'contains', [search]);
        }

        // IL AST StringIndexOf - str.indexOf(sub) -> str.indexOf(sub)
        case 'StringIndexOf': {
          const str = this.transformExpression(node.string || node.value);
          const search = node.search ? this.transformExpression(node.search) : JavaLiteral.String('');
          return new JavaMethodCall(str, 'indexOf', [search]);
        }

        // IL AST StringRepeat - str.repeat(count) -> str.repeat(count) (Java 11+)
        case 'StringRepeat': {
          const str = this.transformExpression(node.string || node.value);
          const count = this.transformExpression(node.count);
          return new JavaMethodCall(str, 'repeat', [count]);
        }

        // IL AST StringReplace - str.replace(old, new) -> str.replace(old, new)
        case 'StringReplace': {
          const str = this.transformExpression(node.string || node.value);
          const search = this.transformExpression(node.search);
          const replacement = this.transformExpression(node.replacement);
          return new JavaMethodCall(str, 'replace', [search, replacement]);
        }

        // IL AST StringSplit - str.split(delim) -> str.split(delim)
        case 'StringSplit': {
          const str = this.transformExpression(node.string || node.value);
          const separator = node.separator ? this.transformExpression(node.separator) : JavaLiteral.String('');
          return new JavaMethodCall(str, 'split', [separator]);
        }

        // IL AST StringStartsWith - str.startsWith(prefix) -> str.startsWith(prefix)
        case 'StringStartsWith': {
          const str = this.transformExpression(node.string || node.value);
          const prefix = this.transformExpression(node.prefix || node.search);
          return new JavaMethodCall(str, 'startsWith', [prefix]);
        }

        // IL AST StringSubstring - str.substring(start, end) -> str.substring(start, end)
        case 'StringSubstring': {
          const str = this.transformExpression(node.string || node.value);
          const args = [];
          if (node.start) args.push(this.transformExpression(node.start));
          if (node.end) args.push(this.transformExpression(node.end));
          return new JavaMethodCall(str, 'substring', args);
        }

        // IL AST StringToLowerCase - str.toLowerCase() -> str.toLowerCase()
        case 'StringToLowerCase': {
          const str = this.transformExpression(node.string || node.value);
          return new JavaMethodCall(str, 'toLowerCase', []);
        }

        // IL AST StringToUpperCase - str.toUpperCase() -> str.toUpperCase()
        case 'StringToUpperCase': {
          const str = this.transformExpression(node.string || node.value);
          return new JavaMethodCall(str, 'toUpperCase', []);
        }

        // IL AST StringTrim - str.trim() -> str.trim()
        case 'StringTrim': {
          const str = this.transformExpression(node.string || node.value);
          return new JavaMethodCall(str, 'trim', []);
        }

        // IL AST StringTransform - generic string method call
        case 'StringTransform': {
          const str = this.transformExpression(node.string || node.value);
          const method = node.method || 'toString';
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          return new JavaMethodCall(str, method, args);
        }

        // ========================[ Buffer/DataView Operations ]========================

        // IL AST DataViewCreation - new DataView(buffer) -> ByteBuffer.wrap(data) or ByteBuffer.allocate(size)
        case 'DataViewCreation': {
          this.addImport('java.nio.ByteBuffer');
          if (node.buffer) {
            const buffer = this.transformExpression(node.buffer);
            let result = new JavaMethodCall(new JavaIdentifier('ByteBuffer'), 'wrap', [buffer]);
            if (node.byteOffset) {
              result = new JavaMethodCall(result, 'position', [this.transformExpression(node.byteOffset)]);
            }
            return result;
          }
          const size = node.size ? this.transformExpression(node.size) : JavaLiteral.Int(0);
          return new JavaMethodCall(new JavaIdentifier('ByteBuffer'), 'allocate', [size]);
        }

        // IL AST DataViewRead - dataView.getXxx(offset) -> byteBuffer.getInt()/getShort() etc.
        case 'DataViewRead': {
          this.addImport('java.nio.ByteBuffer');
          this.addImport('java.nio.ByteOrder');
          const dataView = this.transformExpression(node.dataView || node.object || node.target);
          const jsMethod = node.method || 'getUint8';
          const args = [];
          if (node.offset !== undefined) args.push(this.transformExpression(node.offset));
          else if (node.arguments?.[0]) args.push(this.transformExpression(node.arguments[0]));
          // Map JS DataView method names to Java ByteBuffer methods
          const readMethodMap = {
            'getInt8': 'get', 'getUint8': 'get',
            'getInt16': 'getShort', 'getUint16': 'getShort',
            'getInt32': 'getInt', 'getUint32': 'getInt',
            'getFloat32': 'getFloat', 'getFloat64': 'getDouble',
            'getBigInt64': 'getLong', 'getBigUint64': 'getLong'
          };
          const javaMethod = readMethodMap[jsMethod] || jsMethod;
          let result = new JavaMethodCall(dataView, javaMethod, args);
          // Handle endianness
          if (node.littleEndian !== undefined) {
            const order = node.littleEndian ? 'LITTLE_ENDIAN' : 'BIG_ENDIAN';
            result = new JavaMethodCall(
              new JavaMethodCall(dataView, 'order', [new JavaMemberAccess(new JavaIdentifier('ByteOrder'), order)]),
              javaMethod,
              args
            );
          }
          return result;
        }

        // IL AST DataViewWrite - dataView.setXxx(offset, value) -> byteBuffer.putInt()/putShort() etc.
        case 'DataViewWrite': {
          this.addImport('java.nio.ByteBuffer');
          this.addImport('java.nio.ByteOrder');
          const dataView = this.transformExpression(node.dataView || node.object || node.target);
          const jsMethod = node.method || 'setUint8';
          const args = [];
          if (node.offset !== undefined) args.push(this.transformExpression(node.offset));
          else if (node.arguments?.[0]) args.push(this.transformExpression(node.arguments[0]));
          if (node.value !== undefined) args.push(this.transformExpression(node.value));
          else if (node.arguments?.[1]) args.push(this.transformExpression(node.arguments[1]));
          // Map JS DataView method names to Java ByteBuffer methods
          const writeMethodMap = {
            'setInt8': 'put', 'setUint8': 'put',
            'setInt16': 'putShort', 'setUint16': 'putShort',
            'setInt32': 'putInt', 'setUint32': 'putInt',
            'setFloat32': 'putFloat', 'setFloat64': 'putDouble',
            'setBigInt64': 'putLong', 'setBigUint64': 'putLong'
          };
          const javaWriteMethod = writeMethodMap[jsMethod] || jsMethod;
          let result = new JavaMethodCall(dataView, javaWriteMethod, args);
          if (node.littleEndian !== undefined) {
            const order = node.littleEndian ? 'LITTLE_ENDIAN' : 'BIG_ENDIAN';
            result = new JavaMethodCall(
              new JavaMethodCall(dataView, 'order', [new JavaMemberAccess(new JavaIdentifier('ByteOrder'), order)]),
              javaWriteMethod,
              args
            );
          }
          return result;
        }

        // IL AST BufferCreation - new ArrayBuffer(size) -> new byte[size]
        case 'BufferCreation': {
          const size = node.size ? this.transformExpression(node.size) : JavaLiteral.Int(0);
          return new JavaArrayCreation('byte', size);
        }

        // IL AST TypedArrayCreation is already handled above

        // IL AST TypedArraySet - typedArray.set(source, offset) -> System.arraycopy(source, 0, dest, offset, source.length)
        case 'TypedArraySet': {
          const array = this.transformExpression(node.array);
          const source = node.source ? this.transformExpression(node.source) : new JavaIdentifier('source');
          const offset = node.offset ? this.transformExpression(node.offset) : JavaLiteral.Int(0);
          return new JavaMethodCall(new JavaIdentifier('System'), 'arraycopy', [
            source, JavaLiteral.Int(0), array, offset, new JavaMemberAccess(source, 'length')
          ]);
        }

        // IL AST TypedArraySubarray - typedArray.subarray(begin, end) -> Arrays.copyOfRange(arr, begin, end)
        case 'TypedArraySubarray': {
          this.addImport('java.util.Arrays');
          const array = this.transformExpression(node.array);
          const begin = node.begin ? this.transformExpression(node.begin) : JavaLiteral.Int(0);
          const end = node.end ? this.transformExpression(node.end) : new JavaMemberAccess(array, 'length');
          return new JavaMethodCall(new JavaIdentifier('Arrays'), 'copyOfRange', [array, begin, end]);
        }

        // ========================[ Map/Set/Object Operations ]========================

        // IL AST MapCreation - new Map() -> new HashMap<>()
        case 'MapCreation': {
          this.addImport('java.util.HashMap');
          const args = node.entries ? [this.transformExpression(node.entries)] : [];
          return new JavaObjectCreation(new JavaType('HashMap<>'), args);
        }

        // IL AST MapGet - map.get(key) -> map.get(key)
        case 'MapGet': {
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          return new JavaMethodCall(map, 'get', [key]);
        }

        // IL AST MapSet - map.set(key, value) -> map.put(key, value)
        case 'MapSet': {
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          const value = this.transformExpression(node.value);
          return new JavaMethodCall(map, 'put', [key, value]);
        }

        // IL AST MapHas - map.has(key) -> map.containsKey(key)
        case 'MapHas': {
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          return new JavaMethodCall(map, 'containsKey', [key]);
        }

        // IL AST MapDelete - map.delete(key) -> map.remove(key)
        case 'MapDelete': {
          const map = this.transformExpression(node.map);
          const key = this.transformExpression(node.key);
          return new JavaMethodCall(map, 'remove', [key]);
        }

        // IL AST SetCreation - new Set() -> new HashSet<>()
        case 'SetCreation': {
          this.addImport('java.util.HashSet');
          const args = node.values ? [this.transformExpression(node.values)] : [];
          return new JavaObjectCreation(new JavaType('HashSet<>'), args);
        }

        // IL AST ObjectKeys - Object.keys(obj) -> new ArrayList<>(obj.keySet())
        case 'ObjectKeys': {
          this.addImport('java.util.ArrayList');
          const obj = this.transformExpression(node.argument || node.object);
          return new JavaObjectCreation(new JavaType('ArrayList<>'), [
            new JavaMethodCall(obj, 'keySet', [])
          ]);
        }

        // IL AST ObjectValues - Object.values(obj) -> new ArrayList<>(obj.values())
        case 'ObjectValues': {
          this.addImport('java.util.ArrayList');
          const obj = this.transformExpression(node.argument || node.object);
          return new JavaObjectCreation(new JavaType('ArrayList<>'), [
            new JavaMethodCall(obj, 'values', [])
          ]);
        }

        // IL AST ObjectEntries - Object.entries(obj) -> new ArrayList<>(obj.entrySet())
        case 'ObjectEntries': {
          this.addImport('java.util.ArrayList');
          const obj = this.transformExpression(node.argument || node.object);
          return new JavaObjectCreation(new JavaType('ArrayList<>'), [
            new JavaMethodCall(obj, 'entrySet', [])
          ]);
        }

        // IL AST ObjectCreate - Object.create(proto) -> new HashMap<>() (no direct equivalent)
        case 'ObjectCreate': {
          this.addImport('java.util.HashMap');
          return new JavaObjectCreation(new JavaType('HashMap<>'), []);
        }

        // ========================[ Utility Operations ]========================

        // IL AST Random - Math.random() -> Math.random() or new Random().nextDouble()
        case 'Random': {
          return new JavaMethodCall(new JavaIdentifier('Math'), 'random', []);
        }

        // IL AST DebugOutput - console.log/warn/error -> System.out.println/System.err.println
        case 'DebugOutput': {
          const args = (node.arguments || []).map(arg => this.transformExpression(arg));
          const level = node.level || 'log';
          const stream = (level === 'error' || level === 'warn') ? 'err' : 'out';
          const target = new JavaMemberAccess(new JavaIdentifier('System'), stream);
          return new JavaMethodCall(target, 'println', args);
        }

        // IL AST ParentMethodCall - super.method(args) -> super.method(args)
        case 'ParentMethodCall': {
          const args = (node.arguments || []).map(a => this.transformExpression(a));
          return new JavaMethodCall(new JavaSuper(), node.method, args);
        }

        // IL AST IsFiniteCheck - Number.isFinite(value) -> Double.isFinite(value)
        case 'IsFiniteCheck': {
          const value = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
          return new JavaMethodCall(new JavaIdentifier('Double'), 'isFinite', [value]);
        }

        // IL AST IsNaNCheck - Number.isNaN(value) -> Double.isNaN(value)
        case 'IsNaNCheck': {
          const value = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
          return new JavaMethodCall(new JavaIdentifier('Double'), 'isNaN', [value]);
        }

        // IL AST IsIntegerCheck - Number.isInteger(value) -> value == Math.floor(value)
        case 'IsIntegerCheck': {
          const value = this.transformExpression(node.value || node.argument || node.arguments?.[0]);
          return new JavaBinaryExpression(
            value,
            '==',
            new JavaMethodCall(new JavaIdentifier('Math'), 'floor', [value])
          );
        }

        default:
          this.warnings.push(`Unsupported expression type: ${node.type}`);
          return new JavaIdentifier('/* unsupported: ' + node.type + ' */');
      }
    }

    /**
     * Transform template literal: `Hello ${name}!` -> "Hello " + name + "!"
     * Java uses string concatenation
     */
    transformTemplateLiteral(node) {
      const parts = [];

      for (let i = 0; i < node.quasis.length; ++i) {
        const raw = node.quasis[i].value.raw;
        if (raw) {
          parts.push(JavaLiteral.String(raw));
        }
        if (i < node.expressions.length) {
          parts.push(this.transformExpression(node.expressions[i]));
        }
      }

      // Build concatenation expression: "a" + b + "c"
      if (parts.length === 0) return JavaLiteral.String('');
      if (parts.length === 1) return parts[0];

      let result = parts[0];
      for (let i = 1; i < parts.length; ++i) {
        result = new JavaBinaryExpression(result, '+', parts[i]);
      }
      return result;
    }

    transformLiteral(node) {
      if (node.value === null) return JavaLiteral.Null();
      // Handle undefined - treat same as null in Java
      if (node.value === undefined) return JavaLiteral.Null();
      if (typeof node.value === 'boolean') return JavaLiteral.Boolean(node.value);
      if (typeof node.value === 'string') return JavaLiteral.String(node.value);

      // Handle BigInt
      if (typeof node.value === 'bigint' || node.bigint) {
        const bigValue = typeof node.value === 'bigint' ? node.value : BigInt(node.bigint);
        return new JavaLiteral(`new BigInteger("${bigValue}")`, 'BigInteger');
      }

      if (typeof node.value === 'number') {
        const raw = node.raw || String(node.value);

        // Check for hex literals
        if (raw.startsWith('0x') || raw.startsWith('0X')) {
          // For large hex values, add L suffix
          // Use raw string to preserve precision for 64-bit values
          if (node.value > 0x7FFFFFFF || node.value < -0x80000000) {
            return new JavaLiteral(`${raw}L`, 'long');
          }
          return new JavaLiteral(raw, 'int');
        }

        if (Number.isInteger(node.value)) {
          if (node.value >= -2147483648 && node.value <= 2147483647) {
            return JavaLiteral.Int(node.value);
          } else {
            return JavaLiteral.Long(node.value);
          }
        }
        return JavaLiteral.Double(node.value);
      }
      return JavaLiteral.Null();
    }

    transformIdentifier(node) {
      let name = node.name;

      // Map JavaScript globals to Java equivalents
      if (name === 'undefined') return JavaLiteral.Null();
      if (name === 'NaN') return new JavaIdentifier('Double.NaN');
      if (name === 'Infinity') return new JavaIdentifier('Double.POSITIVE_INFINITY');

      // Convert naming conventions
      // Keep 'this' as-is, convert others to camelCase
      if (name !== 'this' && name !== 'super') {
        name = this.toCamelCase(name);
      }

      // Sanitize reserved words
      name = this.sanitizeName(name);

      return new JavaIdentifier(name);
    }

    transformObjectExpression(node) {
      // Java doesn't have object literals - need to create a Map or custom class
      // For simple cases, use HashMap with explicit type parameters for type inference
      this.addImport('java.util.HashMap');
      this.addImport('java.util.Map');

      const creation = new JavaObjectCreation(new JavaType('HashMap<String, Object>'), []);

      // If there are properties, generate put() calls
      if (node.properties && node.properties.length > 0) {
        this.warnings.push('Object literals converted to HashMap - may need manual review');
      }

      return creation;
    }

    transformBinaryExpression(node) {
      let operator = node.operator;

      // Map JavaScript operators to Java
      if (operator === '===') operator = '==';
      if (operator === '!==') operator = '!=';

      // Handle >>> 0 idiom (convert to unsigned int)
      if (operator === '>>>' && node.right.type === 'Literal' && node.right.value === 0) {
        const left = this.transformExpression(node.left);
        // In Java, need to mask with 0xFFFFFFFFL for unsigned behavior
        return new JavaBinaryExpression(left, '&', new JavaLiteral('0xFFFFFFFFL', 'long'));
      }

      // Handle unsigned operations using Integer.toUnsignedLong() etc.
      if (operator === '>>>') {
        const left = this.transformExpression(node.left);
        const right = this.transformExpression(node.right);
        // Java >>> works the same as JS for unsigned right shift
        return new JavaBinaryExpression(left, '>>>', right);
      }

      // Handle string equality (.equals() for objects)
      if ((operator === '==' || operator === '!=') && this.needsEqualsMethod(node.left, node.right)) {
        const left = this.transformExpression(node.left);
        const right = this.transformExpression(node.right);
        const equalsCall = new JavaMethodCall(left, 'equals', [right]);
        if (operator === '!=') {
          return new JavaUnaryExpression('!', equalsCall, true);
        }
        return equalsCall;
      }

      const left = this.transformExpression(node.left);
      const right = this.transformExpression(node.right);

      return new JavaBinaryExpression(left, operator, right);
    }

    /**
     * Check if comparison needs .equals() method instead of ==
     */
    needsEqualsMethod(leftNode, rightNode) {
      const leftType = this.inferExpressionType(leftNode);
      const rightType = this.inferExpressionType(rightNode);

      // Use .equals() for String, BigInteger, and other objects
      // Don't use for primitives (int, boolean, etc.)
      const objectTypes = ['String', 'BigInteger', 'Object'];
      return objectTypes.includes(leftType.name) || objectTypes.includes(rightType.name);
    }

    transformUnaryExpression(node) {
      const operand = this.transformExpression(node.argument);
      return new JavaUnaryExpression(node.operator, operand, node.prefix);
    }

    transformUpdateExpression(node) {
      const operand = this.transformExpression(node.argument);
      return new JavaUnaryExpression(node.operator, operand, node.prefix);
    }

    transformAssignmentExpression(node) {
      const target = this.transformExpression(node.left);
      let value = this.transformExpression(node.right);

      // Check if assigning to a List field - need to wrap arrays in Arrays.asList()
      const listFieldNames = ['documentation', 'references', 'knownVulnerabilities',
                              'supportedKeySizes', 'supportedBlockSizes', 'tests'];

      // Get field name from various AST node types
      let fieldName = null;
      if (node.left.type === 'MemberExpression' && node.left.property) {
        fieldName = this.toCamelCase(node.left.property.name);
      } else if (node.left.type === 'ThisPropertyAccess') {
        // IL AST uses ThisPropertyAccess with .property being the property name string
        fieldName = this.toCamelCase(node.left.property);
      }

      if (fieldName) {
        const isListField = listFieldNames.includes(fieldName);
        const isArrayCreation = value && value.nodeType === 'ArrayCreation';
        const isArrayValue = node.right.type === 'ArrayExpression' ||
                            node.right.type === 'ArrayLiteral' ||
                            node.right.type === 'ArrayLiteralExpression' ||
                            isArrayCreation;

        if (isListField && isArrayValue) {
          // Use Arrays.asList(...) directly - returns fixed-size List<T>
          // This is simpler and avoids type inference issues with ArrayList diamond
          this.addImport('java.util.Arrays');
          const elements = isArrayCreation ? value.initializer : [value];
          value = new JavaMethodCall(new JavaIdentifier('Arrays'), 'asList', elements);
        }
      }

      return new JavaAssignment(target, node.operator, value);
    }

    transformMemberExpression(node) {
      // Check for known enum type access (categoryType.STREAM -> CategoryType.STREAM)
      if (node.object.type === 'Identifier') {
        const enumMap = {
          'categoryType': 'CategoryType',
          'securityStatus': 'SecurityStatus',
          'complexityType': 'ComplexityType',
          'countryCode': 'CountryCode',
          'CategoryType': 'CategoryType',
          'SecurityStatus': 'SecurityStatus',
          'ComplexityType': 'ComplexityType',
          'CountryCode': 'CountryCode'
        };
        const enumName = enumMap[node.object.name];
        if (enumName && !node.computed) {
          // This is an enum constant access
          return new JavaMemberAccess(new JavaIdentifier(enumName), node.property.name);
        }
      }

      const object = this.transformExpression(node.object);

      if (node.computed) {
        // Array access: arr[index]
        const index = this.transformExpression(node.property);
        return new JavaArrayAccess(object, index);
      } else {
        // Member access: obj.member
        let member = node.property.name;

        // Convert field names to camelCase for 'this' member access (Java naming convention)
        if (node.object.type === 'ThisExpression') {
          member = this.toCamelCase(member);
        }

        return new JavaMemberAccess(object, member);
      }
    }

    transformCallExpression(node) {
      if (node.callee.type === 'MemberExpression') {
        const object = this.transformExpression(node.callee.object);
        const methodName = node.callee.property.name;
        const args = node.arguments.map(arg => this.transformExpression(arg));

        // Map OpCodes methods to Java equivalents
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'OpCodes') {
          return this.transformOpCodesCall(methodName, args);
        }

        // Handle Array methods (JavaScript built-ins)
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'Array') {
          // Array.isArray(x) -> x instanceof byte[] (or use reflection for generic)
          if (methodName === 'isArray' && args.length === 1)
            return new JavaInstanceOf(args[0], new JavaIdentifier('byte[]'));
        }

        // Handle Object methods (JavaScript built-ins)
        if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'Object') {
          // Object.freeze() - Java doesn't have this, just return the argument
          if (methodName === 'freeze' && args.length > 0)
            return args[0];
          // Object.keys(obj) -> obj.keySet() for Map, or new ArrayList<>(obj.keySet())
          if (methodName === 'keys' && args.length === 1) {
            this.addImport('java.util.ArrayList');
            return new JavaMethodCall(null, 'new ArrayList<>', [new JavaMethodCall(args[0], 'keySet', [])]);
          }
          // Object.values(obj) -> new ArrayList<>(obj.values())
          if (methodName === 'values' && args.length === 1) {
            this.addImport('java.util.ArrayList');
            return new JavaMethodCall(null, 'new ArrayList<>', [new JavaMethodCall(args[0], 'values', [])]);
          }
          // Object.entries(obj) -> new ArrayList<>(obj.entrySet())
          if (methodName === 'entries' && args.length === 1) {
            this.addImport('java.util.ArrayList');
            return new JavaMethodCall(null, 'new ArrayList<>', [new JavaMethodCall(args[0], 'entrySet', [])]);
          }
          // Object.assign(target, source) -> target.putAll(source); return target
          if (methodName === 'assign' && args.length >= 2) {
            // For now just return target - proper implementation needs statement
            return args[0];
          }
        }

        // Map array methods
        if (methodName === 'push') {
          // arr.push(x) -> arr = Arrays.copyOf(arr, arr.length + 1); arr[arr.length-1] = x
          this.warnings.push('Array.push() requires manual conversion in Java');
          return new JavaMethodCall(object, 'add', args);
        } else if (methodName === 'slice') {
          // arr.slice(start, end) -> Arrays.copyOfRange(arr, start, end)
          this.addImport('java.util.Arrays');
          return new JavaMethodCall(new JavaIdentifier('Arrays'), 'copyOfRange',
            [object, ...args]);
        } else if (methodName === 'fill') {
          // arr.fill(value) -> Arrays.fill(arr, value)
          this.addImport('java.util.Arrays');
          return new JavaMethodCall(new JavaIdentifier('Arrays'), 'fill',
            [object, ...args]);
        }

        return new JavaMethodCall(object, methodName, args);
      } else {
        // Static or top-level function call
        const methodName = node.callee.name;
        const args = node.arguments.map(arg => this.transformExpression(arg));
        return new JavaMethodCall(null, methodName, args);
      }
    }

    /**
     * Transform OpCodes method calls to Java equivalents
     */
    transformOpCodesCall(methodName, args) {
      // Map common OpCodes methods to Java equivalents
      const opCodesMap = {
        // Rotation
        'RotL32': (args) => new JavaMethodCall(new JavaIdentifier('Integer'), 'rotateLeft', args),
        'RotR32': (args) => new JavaMethodCall(new JavaIdentifier('Integer'), 'rotateRight', args),
        'RotL64': (args) => new JavaMethodCall(new JavaIdentifier('Long'), 'rotateLeft', args),
        'RotR64': (args) => new JavaMethodCall(new JavaIdentifier('Long'), 'rotateRight', args),
        'RotL16': (args) => new JavaBinaryExpression(
          new JavaBinaryExpression(
            new JavaBinaryExpression(args[0], '<<', args[1]),
            '|',
            new JavaBinaryExpression(args[0], '>>', new JavaBinaryExpression(JavaLiteral.Int(16), '-', args[1]))
          ),
          '&', JavaLiteral.Int(0xFFFF)
        ),
        'RotR16': (args) => new JavaBinaryExpression(
          new JavaBinaryExpression(
            new JavaBinaryExpression(args[0], '>>', args[1]),
            '|',
            new JavaBinaryExpression(args[0], '<<', new JavaBinaryExpression(JavaLiteral.Int(16), '-', args[1]))
          ),
          '&', JavaLiteral.Int(0xFFFF)
        ),
        'RotL8': (args) => new JavaBinaryExpression(
          new JavaBinaryExpression(
            new JavaBinaryExpression(args[0], '<<', args[1]),
            '|',
            new JavaBinaryExpression(args[0], '>>', new JavaBinaryExpression(JavaLiteral.Int(8), '-', args[1]))
          ),
          '&', JavaLiteral.Int(0xFF)
        ),
        'RotR8': (args) => new JavaBinaryExpression(
          new JavaBinaryExpression(
            new JavaBinaryExpression(args[0], '>>', args[1]),
            '|',
            new JavaBinaryExpression(args[0], '<<', new JavaBinaryExpression(JavaLiteral.Int(8), '-', args[1]))
          ),
          '&', JavaLiteral.Int(0xFF)
        ),

        // Bit masks
        'BitMask': (args) => new JavaBinaryExpression(
          new JavaBinaryExpression(JavaLiteral.Int(1), '<<', args[0]),
          '-', JavaLiteral.Int(1)
        ),
        'AndN': (args) => new JavaBinaryExpression(args[0], '&', args[1]),
        'OrN': (args) => new JavaBinaryExpression(args[0], '|', args[1]),
        'XorN': (args) => new JavaBinaryExpression(args[0], '^', args[1]),
        'NotN': (args) => new JavaUnaryExpression('~', args[0]),

        // Byte packing/unpacking
        'Pack32BE': (args) => this.createByteBufferPack(args, true, 4),
        'Pack32LE': (args) => this.createByteBufferPack(args, false, 4),
        'Unpack32BE': (args) => this.createByteBufferUnpack(args[0], true, 4),
        'Unpack32LE': (args) => this.createByteBufferUnpack(args[0], false, 4),
        'Pack16BE': (args) => this.createByteBufferPack(args, true, 2),
        'Pack16LE': (args) => this.createByteBufferPack(args, false, 2),
        'Unpack16BE': (args) => this.createByteBufferUnpack(args[0], true, 2),
        'Unpack16LE': (args) => this.createByteBufferUnpack(args[0], false, 2),

        // Array operations
        'XorArrays': (args) => this.createXorArraysCode(args[0], args[1]),
        'ClearArray': (args) => {
          this.addImport('java.util.Arrays');
          return new JavaMethodCall(new JavaIdentifier('Arrays'), 'fill', [args[0], JavaLiteral.Int(0)]);
        },

        // Hex conversion
        'Hex8ToBytes': (args) => this.createHexToBytes(args[0]),
        'BytesToHex8': (args) => this.createBytesToHex(args[0]),

        // String conversions
        'AnsiToBytes': (args) => new JavaMethodCall(args[0], 'getBytes', [JavaLiteral.String('US-ASCII')])
      };

      if (opCodesMap[methodName]) {
        this.addImport('java.nio.ByteBuffer');
        return opCodesMap[methodName](args);
      }

      // Default: assume static method call
      return new JavaMethodCall(new JavaIdentifier('OpCodes'), methodName, args);
    }

    /**
     * Create ByteBuffer packing code for bytes to int/long
     */
    createByteBufferPack(args, isBigEndian, byteCount) {
      // ByteBuffer.allocate(4).order(ByteOrder.BIG_ENDIAN).put(b0).put(b1).put(b2).put(b3).getInt(0)
      this.addImport('java.nio.ByteOrder');
      const order = isBigEndian ? 'BIG_ENDIAN' : 'LITTLE_ENDIAN';

      // Build method chain
      let chain = new JavaMethodCall(new JavaIdentifier('ByteBuffer'), 'allocate',
        [new JavaLiteral(byteCount, 'int')]);
      chain = new JavaMethodCall(chain, 'order',
        [new JavaMemberAccess(new JavaIdentifier('ByteOrder'), order)]);

      // Add put() calls for each byte
      for (const arg of args) {
        chain = new JavaMethodCall(chain, 'put', [arg]);
      }

      // Get result
      const getMethod = byteCount === 4 ? 'getInt' : 'getLong';
      return new JavaMethodCall(chain, getMethod, [new JavaLiteral(0, 'int')]);
    }

    /**
     * Create ByteBuffer unpacking code for int/long to bytes
     */
    createByteBufferUnpack(value, isBigEndian, byteCount) {
      // ByteBuffer.allocate(4).order(ByteOrder.BIG_ENDIAN).putInt(value).array()
      this.addImport('java.nio.ByteOrder');
      const order = isBigEndian ? 'BIG_ENDIAN' : 'LITTLE_ENDIAN';
      const putMethod = byteCount === 4 ? 'putInt' : 'putLong';

      let chain = new JavaMethodCall(new JavaIdentifier('ByteBuffer'), 'allocate',
        [new JavaLiteral(byteCount, 'int')]);
      chain = new JavaMethodCall(chain, 'order',
        [new JavaMemberAccess(new JavaIdentifier('ByteOrder'), order)]);
      chain = new JavaMethodCall(chain, putMethod, [value]);
      return new JavaMethodCall(chain, 'array', []);
    }

    /**
     * Create XOR arrays code
     */
    createXorArraysCode(arr1, arr2) {
      // Generate inline loop or utility method call
      this.warnings.push('XorArrays requires custom implementation in Java');
      return new JavaMethodCall(new JavaIdentifier('OpCodes'), 'xorArrays', [arr1, arr2]);
    }

    /**
     * Create hex to bytes conversion
     */
    createHexToBytes(hexString) {
      this.warnings.push('Hex8ToBytes requires custom implementation in Java');
      return new JavaMethodCall(new JavaIdentifier('OpCodes'), 'hexToBytes', [hexString]);
    }

    /**
     * Create bytes to hex conversion
     */
    createBytesToHex(byteArray) {
      this.warnings.push('BytesToHex8 requires custom implementation in Java');
      return new JavaMethodCall(new JavaIdentifier('OpCodes'), 'bytesToHex', [byteArray]);
    }

    transformNewExpression(node) {
      const typeName = node.callee.name || 'Object';
      const args = node.arguments.map(arg => this.transformExpression(arg));

      // Map TypedArrays to Java array types
      const typedArrayMap = {
        'Uint8Array': JavaType.Byte(),
        'Uint16Array': JavaType.Short(),
        'Uint32Array': JavaType.Int(),
        'Int8Array': JavaType.Byte(),
        'Int16Array': JavaType.Short(),
        'Int32Array': JavaType.Int(),
        'Float32Array': JavaType.Float(),
        'Float64Array': JavaType.Double()
      };

      if (typedArrayMap[typeName]) {
        const hasArrayInit = node.arguments.length > 0 &&
          node.arguments[0].type === 'ArrayExpression';

        if (hasArrayInit) {
          // new Uint8Array([1, 2, 3]) -> new byte[] { 1, 2, 3 }
          const elements = node.arguments[0].elements.map(e => this.transformExpression(e));
          return new JavaArrayCreation(typedArrayMap[typeName], null, elements);
        }

        // new Uint8Array(n) -> new byte[n]
        return new JavaArrayCreation(typedArrayMap[typeName], args[0] || JavaLiteral.Int(0), null);
      }

      // Special handling for arrays
      if (typeName === 'Array') {
        if (args.length === 1) {
          // new Array(size)
          return new JavaArrayCreation(JavaType.Int(), args[0], null);
        }
      }

      const type = this.mapType(typeName);
      return new JavaObjectCreation(type, args);
    }

    transformArrayExpression(node) {
      const elements = node.elements.map(el => this.transformExpression(el));

      // Infer element type from IL node or first element
      let elementType = JavaType.Int();

      // Use IL's elementType if available
      if (node.elementType) {
        const ilTypeMap = {
          'int8': 'byte', 'uint8': 'byte', 'int16': 'short', 'uint16': 'short',
          'int32': 'int', 'uint32': 'int', 'int64': 'long', 'uint64': 'long',
          'float32': 'float', 'float64': 'double', 'string': 'String',
          'boolean': 'boolean', 'object': 'Object'
        };
        const mapped = ilTypeMap[node.elementType] || node.elementType;
        elementType = new JavaType(mapped);
      }

      // Override with more specific type from first element
      if (node.elements && node.elements.length > 0) {
        const firstEl = node.elements[0];
        if (firstEl) {
          if (firstEl.type === 'Literal' && typeof firstEl.value === 'string') {
            elementType = JavaType.String();
          } else if (firstEl.type === 'NewExpression' || firstEl.type === 'ObjectCreation') {
            const callee = firstEl.callee || firstEl.type;
            if (callee && callee.name) {
              elementType = new JavaType(callee.name);
            } else if (firstEl.className) {
              elementType = new JavaType(firstEl.className);
            }
          } else if (firstEl.type === 'ObjectExpression') {
            elementType = new JavaType('HashMap<String, Object>');
          }
        }
      }

      return new JavaArrayCreation(elementType, null, elements);
    }

    transformConditionalExpression(node) {
      const condition = this.transformExpression(node.test);
      const trueExpr = this.transformExpression(node.consequent);
      const falseExpr = this.transformExpression(node.alternate);
      return new JavaConditional(condition, trueExpr, falseExpr);
    }

    transformLambdaExpression(node) {
      const params = node.params.map(p => p.name || p);
      const body = node.body.type === 'BlockStatement' ?
        this.transformBlockStatement(node.body) :
        this.transformExpression(node.body);
      return new JavaLambda(params, body);
    }

    // ========================[ TYPE INFERENCE ]========================

    /**
     * Map a type name to JavaType
     */
    mapType(typeName) {
      if (!typeName) return JavaType.Object();
      // Handle object types with name property (from IL AST)
      if (typeof typeName === 'object') {
        if (typeName.name) typeName = typeName.name;
        else if (typeName.type) typeName = typeName.type;
        else return JavaType.Object();
      }
      if (typeof typeName !== 'string') typeName = String(typeName);

      // Handle union types (e.g., "uint8[]|null") - Java objects are nullable by default
      if (typeName.includes('|')) {
        // Remove null/undefined from union types
        const parts = typeName.split('|').filter(p =>
          p.trim() !== 'null' && p.trim() !== 'undefined' && p.trim() !== 'void'
        );
        if (parts.length === 0) return JavaType.Object();
        typeName = parts[0].trim();
      }

      // Handle arrays
      if (typeName.endsWith('[]')) {
        const elementTypeName = typeName.slice(0, -2);
        const elementType = this.mapType(elementTypeName);
        return JavaType.Array(elementType);
      }

      // Map known types
      const javaTypeName = TYPE_MAP[typeName] || typeName;

      switch (javaTypeName) {
        case 'byte': return JavaType.Byte();
        case 'short': return JavaType.Short();
        case 'int': return JavaType.Int();
        case 'long': return JavaType.Long();
        case 'float': return JavaType.Float();
        case 'double': return JavaType.Double();
        case 'boolean': return JavaType.Boolean();
        case 'char': return JavaType.Char();
        case 'String': return JavaType.String();
        case 'void': return JavaType.Void();
        case 'BigInteger': return JavaType.BigInteger();
        default: return new JavaType(javaTypeName);
      }
    }

    inferReturnType(node) {
      // Use typeKnowledge if available
      if (this.typeKnowledge && node.typeInfo?.returns) {
        return this.mapTypeFromKnowledge(node.typeInfo.returns);
      }

      // Check for return statements
      if (node.body && node.body.type === 'BlockStatement') {
        for (const stmt of node.body.body) {
          if (stmt.type === 'ReturnStatement' && stmt.argument) {
            return this.inferExpressionType(stmt.argument);
          }
        }
      }
      return JavaType.Void();
    }

    inferParameterType(paramName) {
      // Use name-based heuristics for crypto code
      const lowerName = paramName.toLowerCase();

      // Boolean parameters - check BEFORE other patterns
      if (lowerName.startsWith('is') || lowerName.startsWith('has') ||
          lowerName.startsWith('can') || lowerName.startsWith('should') ||
          lowerName.startsWith('will') || lowerName.startsWith('enable') ||
          lowerName === 'inverse' || lowerName === 'decrypt' ||
          lowerName === 'encrypt' || lowerName.includes('flag')) {
        return JavaType.Boolean();
      }

      // Array-related names
      if (lowerName.includes('key') || lowerName.includes('data') ||
          lowerName.includes('input') || lowerName.includes('output') ||
          lowerName.includes('block') || lowerName.includes('bytes') ||
          lowerName.includes('buffer')) {
        return JavaType.Array(JavaType.Byte());
      }

      // Index/position names
      if (lowerName.includes('index') || lowerName.includes('pos') ||
          lowerName.includes('offset') || lowerName.includes('length') ||
          lowerName === 'i' || lowerName === 'j') {
        return JavaType.Int();
      }

      // Algorithm instance reference (typically parent class reference)
      if (lowerName === 'algorithm' || lowerName === 'algo' ||
          lowerName === 'parent' || lowerName === 'owner') {
        // Use generic Algorithm type - will be specialized during transformation
        return new JavaType('Algorithm');
      }

      // Default to int for crypto operations (most common)
      return JavaType.Int();
    }

    inferPropertyType(node) {
      if (node.value) {
        return this.inferExpressionType(node.value);
      }
      return JavaType.Object();
    }

    inferVariableType(node) {
      if (node.init) {
        return this.inferExpressionType(node.init);
      }
      return JavaType.Object();
    }

    inferExpressionType(node) {
      if (!node) return JavaType.Object();

      switch (node.type) {
        case 'Literal':
          if (node.value === null) return JavaType.Object();
          if (typeof node.value === 'boolean') return JavaType.Boolean();
          if (typeof node.value === 'string') return JavaType.String();
          if (typeof node.value === 'number') {
            if (Number.isInteger(node.value)) return JavaType.Int();
            return JavaType.Double();
          }
          if (typeof node.value === 'bigint' || node.bigint) return JavaType.BigInteger();
          return JavaType.Object();

        case 'ArrayExpression':
          if (node.elements.length > 0) {
            const elemType = this.inferExpressionType(node.elements[0]);
            return JavaType.Array(elemType);
          }
          return JavaType.Array(JavaType.Byte()); // Default for crypto

        case 'NewExpression':
          return this.mapType(node.callee.name);

        case 'BinaryExpression':
        case 'LogicalExpression':
          return this.inferBinaryExpressionType(node);

        case 'CallExpression':
          return this.inferCallExpressionType(node);

        case 'Identifier':
          return this.getVariableType(node.name) || JavaType.Int();

        default:
          return JavaType.Object();
      }
    }

    inferBinaryExpressionType(node) {
      const op = node.operator;

      // Comparison operators return boolean
      if (['==', '!=', '===', '!==', '<', '>', '<=', '>='].includes(op))
        return JavaType.Boolean();

      // For && and ||, JavaScript returns the actual operand values (not boolean)
      // So we need to infer from operand types for null-coalescing patterns
      if (op === '&&' || op === '||') {
        const leftType = this.inferExpressionType(node.left);
        // If left operand is boolean, this is a real boolean expression
        if (leftType && leftType.name === 'boolean')
          return JavaType.Boolean();
        // Otherwise, treat as null-coalescing and return operand type
        if (leftType && leftType.name !== 'Object')
          return leftType;
        const rightType = this.inferExpressionType(node.right);
        if (rightType && rightType.name !== 'Object')
          return rightType;
        return JavaType.Object();
      }

      // >>> 0 returns int (unsigned semantics)
      if (op === '>>>' && node.right.type === 'Literal' && node.right.value === 0) {
        return JavaType.Int();
      }

      // Bitwise and arithmetic - infer from operands
      const leftType = this.inferExpressionType(node.left);
      const rightType = this.inferExpressionType(node.right);

      // Return wider type
      if (leftType.name === 'long' || rightType.name === 'long') return JavaType.Long();
      if (leftType.name === 'int' || rightType.name === 'int') return JavaType.Int();
      if (leftType.name === 'short' || rightType.name === 'short') return JavaType.Short();

      return JavaType.Int();
    }

    inferCallExpressionType(node) {
      // Check OpCodes methods
      if (node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'OpCodes') {
        return this.getOpCodesReturnType(node.callee.property.name);
      }

      // Array methods
      if (node.callee.type === 'MemberExpression') {
        const methodName = node.callee.property.name;
        if (methodName === 'slice' || methodName === 'concat') {
          return JavaType.Array(JavaType.Byte());
        }
      }

      return JavaType.Object();
    }

    /**
     * Get the type of a variable from the type map
     */
    getVariableType(name) {
      return this.variableTypes.get(name) || null;
    }

    getOpCodesReturnType(methodName) {
      // Use typeKnowledge if available
      if (this.typeKnowledge?.opCodesTypes && this.typeKnowledge.opCodesTypes[methodName]) {
        const opInfo = this.typeKnowledge.opCodesTypes[methodName];
        return this.mapTypeFromKnowledge(opInfo.returns);
      }

      // Fallback to common patterns
      const returnTypes = {
        'RotL32': JavaType.Int(),
        'RotR32': JavaType.Int(),
        'RotL64': JavaType.Long(),
        'RotR64': JavaType.Long(),
        'Pack32BE': JavaType.Int(),
        'Pack32LE': JavaType.Int(),
        'Unpack32BE': JavaType.Array(JavaType.Byte()),
        'Unpack32LE': JavaType.Array(JavaType.Byte()),
        'XorArrays': JavaType.Array(JavaType.Byte()),
        'Hex8ToBytes': JavaType.Array(JavaType.Byte()),
        'BytesToHex8': JavaType.String()
      };

      return returnTypes[methodName] || JavaType.Object();
    }

    mapTypeFromKnowledge(typeName) {
      if (!typeName) return JavaType.Object();
      // Handle object types with name property (from IL AST)
      if (typeof typeName === 'object') {
        if (typeName.name) typeName = typeName.name;
        else if (typeName.type) typeName = typeName.type;
        else return JavaType.Object();
      }
      if (typeof typeName !== 'string') typeName = String(typeName);

      // Handle union types (e.g., "uint8[]|null") - Java objects are nullable by default
      if (typeName.includes('|')) {
        const parts = typeName.split('|').filter(p =>
          p.trim() !== 'null' && p.trim() !== 'undefined' && p.trim() !== 'void'
        );
        if (parts.length === 0) return JavaType.Object();
        typeName = parts[0].trim();
      }

      // Handle arrays
      if (typeName.endsWith('[]')) {
        const elementTypeName = typeName.slice(0, -2);
        const elementType = this.mapTypeFromKnowledge(elementTypeName);
        return JavaType.Array(elementType);
      }

      return this.mapType(typeName);
    }

    // ========================[ NAMING CONVENTIONS ]========================

    /**
     * Sanitize identifier names to avoid Java reserved words
     */
    sanitizeName(name) {
      if (!name) return name;
      if (RESERVED_WORDS.has(name)) {
        return name + '_';  // Append underscore to avoid collision
      }
      return name;
    }

    /**
     * Convert to camelCase (Java method naming convention)
     */
    toCamelCase(name) {
      if (!name) return name;

      // If already camelCase, return as-is
      if (/^[a-z][a-zA-Z0-9]*$/.test(name)) return name;

      // Convert PascalCase to camelCase
      if (/^[A-Z]/.test(name)) {
        return name[0].toLowerCase() + name.slice(1);
      }

      // Convert snake_case to camelCase
      return name.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    }

    /**
     * Convert to PascalCase (Java class naming convention)
     */
    toPascalCase(name) {
      if (!name) return name;

      // If already PascalCase, return as-is
      if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) return name;

      // Convert camelCase to PascalCase
      if (/^[a-z]/.test(name)) {
        return name[0].toUpperCase() + name.slice(1);
      }

      // Convert snake_case to PascalCase
      return name.replace(/(^|_)([a-z])/g, (_, __, letter) => letter.toUpperCase());
    }

    /**
     * Convert to UPPER_SNAKE_CASE (Java constant naming convention)
     */
    toConstantCase(name) {
      if (!name) return name;

      // If already UPPER_SNAKE_CASE, return as-is
      if (/^[A-Z][A-Z0-9_]*$/.test(name)) return name;

      // Convert camelCase/PascalCase to UPPER_SNAKE_CASE
      return name
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
        .toUpperCase();
    }

    /**
     * Get the return value from an IIFE if it has one
     */
    getIIFEReturnValue(callNode) {
      const func = callNode.callee;
      if (!func.body || func.body.type !== 'BlockStatement') {
        // Arrow function with expression body - the body IS the return value
        if (func.body) return func.body;
        return null;
      }

      // Look for a return statement at the end of the function body
      const body = func.body.body;
      if (!body || body.length === 0) return null;

      const lastStmt = body[body.length - 1];
      if (lastStmt.type === 'ReturnStatement' && lastStmt.argument)
        return lastStmt.argument;

      return null;
    }
  }

  // Export
  const exports = { JavaTransformer };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.JavaTransformer = JavaTransformer;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
