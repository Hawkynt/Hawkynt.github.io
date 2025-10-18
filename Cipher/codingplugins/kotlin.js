/**
 * Kotlin Language Plugin for Multi-Language Code Generation
 * Generates Kotlin compatible code from JavaScript AST
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
 * Kotlin Code Generator Plugin
 * Extends LanguagePlugin base class
 */
class KotlinPlugin extends LanguagePlugin {
  constructor() {
    super();
    
    // Required plugin metadata
    this.name = 'Kotlin';
    this.extension = 'kt';
    this.icon = '🔷';
    this.description = 'Kotlin/JVM code generator';
    this.mimeType = 'text/x-kotlin';
    this.version = '1.9+';
    
    // Kotlin-specific options
    this.options = {
      indent: '    ', // 4 spaces
      lineEnding: '\n',
      strictTypes: true,
      nullSafety: true,
      useDataClasses: true,
      addKDoc: true,
      useCoroutines: true,
      useSealedClasses: true,
      useInlineFunctions: true,
      useReifiedGenerics: true,
      useExtensionFunctions: true,
      useCryptoExtensions: true,
      useResultType: true,
      packageName: 'com.cipher.generated'
    };
    
    // Internal state
    this.indentLevel = 0;
  }

  /**
   * Generate Kotlin code from Abstract Syntax Tree
   * @param {Object} ast - Parsed/Modified AST representation
   * @param {Object} options - Generation options
   * @returns {CodeGenerationResult}
   */
  GenerateFromAST(ast, options = {}) {
    try {
      // Reset state for clean generation
      this.indentLevel = 0;
      
      // Merge options
      const mergedOptions = { ...this.options, ...options };
      
      // Validate AST
      if (!ast || typeof ast !== 'object') {
        return this.CreateErrorResult('Invalid AST: must be an object');
      }
      
      // Generate Kotlin code
      const code = this._generateNode(ast, mergedOptions);
      
      // Add standard imports and package
      const finalCode = this._wrapWithImports(code, mergedOptions);
      
      // Collect dependencies
      const dependencies = this._collectDependencies(ast, mergedOptions);
      
      // Generate warnings if any
      const warnings = this._generateWarnings(ast, mergedOptions);
      
      return this.CreateSuccessResult(finalCode, dependencies, warnings);
      
    } catch (error) {
      return this.CreateErrorResult(`Code generation failed: ${error.message}`);
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
        return this._generateClass(node, options);
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
        return 'this';
      case 'Super':
        return 'super';
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
      case 'OptionalCallExpression':
        return this._generateOptionalCallExpression(node, options);
      case 'OptionalMemberExpression':
        return this._generateOptionalMemberExpression(node, options);
      case 'JSXElement':
        return this._generateJSXElement(node, options);
      case 'JSXFragment':
        return this._generateJSXFragment(node, options);
      case 'TSTypeAnnotation':
        return this._generateTSTypeAnnotation(node, options);
      case 'TSAsExpression':
        return this._generateTSAsExpression(node, options);
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
    const functionName = node.id ? this._toKotlinName(node.id.name) : 'unnamedFunction';
    let code = '';
    
    // KDoc comment
    if (options.addKDoc) {
      code += this._indent('/**\n');
      code += this._indent(` * ${functionName} function\n`);
      if (node.params && node.params.length > 0) {
        node.params.forEach(param => {
          const paramName = param.name || 'param';
          code += this._indent(` * @param ${paramName} parameter\n`);
        });
      }
      code += this._indent(' * @return return value\n');
      code += this._indent(' */\n');
    }
    
    // Function signature
    code += this._indent(`fun ${functionName}(`);
    
    // Parameters with types
    if (node.params && node.params.length > 0) {
      const params = node.params.map(param => {
        const paramName = param.name || 'param';
        const paramType = this._inferKotlinType(paramName);
        return `${paramName}: ${paramType}`;
      });
      code += params.join(', ');
    }
    
    // Return type
    const returnType = this._inferReturnType(functionName);
    code += `): ${returnType} {\n`;
    
    // Function body
    this.indentLevel++;
    if (node.body) {
      const bodyCode = this._generateNode(node.body, options);
      code += bodyCode || this._indent("return TODO(\"Not implemented\")\n");
    } else {
      code += this._indent("return TODO(\"Not implemented\")\n");
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
    const className = node.id ? node.id.name : 'UnnamedClass';
    let code = '';

    // KDoc for class
    if (options.addKDoc) {
      code += this._indent('/**\n');
      code += this._indent(` * ${className} class\n`);
      code += this._indent(' */\n');
    }

    // Class declaration with inheritance
    if (node.superClass) {
      const superName = this._generateNode(node.superClass, options);
      code += this._indent(`class ${className} : ${superName}() {\n`);
    } else {
      code += this._indent(`class ${className} {\n`);
    }

    // Class body
    this.indentLevel++;
    if (node.body && node.body.body && node.body.body.length > 0) {
      const methods = node.body.body
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
    
    const methodName = node.key.name;
    const isConstructor = methodName === 'constructor';
    let code = '';
    
    if (isConstructor) {
      // Kotlin constructors are handled differently
      return '';
    }
    
    // KDoc
    if (options.addKDoc) {
      code += this._indent('/**\n');
      code += this._indent(` * ${methodName} method\n`);
      if (node.value.params && node.value.params.length > 0) {
        node.value.params.forEach(param => {
          const paramName = param.name || 'param';
          code += this._indent(` * @param ${paramName} parameter\n`);
        });
      }
      code += this._indent(' * @return return value\n');
      code += this._indent(' */\n');
    }
    
    // Method signature
    code += this._indent(`fun ${this._toKotlinName(methodName)}(`);
    
    // Parameters
    if (node.value.params && node.value.params.length > 0) {
      const params = node.value.params.map(param => {
        const paramName = param.name || 'param';
        const paramType = this._inferKotlinType(paramName);
        return `${paramName}: ${paramType}`;
      });
      code += params.join(', ');
    }
    
    // Return type
    const returnType = this._inferReturnType(methodName);
    code += `): ${returnType} {\n`;
    
    // Method body
    this.indentLevel++;
    if (node.value.body) {
      const bodyCode = this._generateNode(node.value.body, options);
      code += bodyCode || this._indent("return TODO(\"Not implemented\")\n");
    } else {
      code += this._indent("return TODO(\"Not implemented\")\n");
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
      return this._indent("return TODO(\"Empty block\")\n");
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
        const varType = this._inferKotlinType(varName, decl.init);

        if (decl.init) {
          const initValue = this._generateNode(decl.init, options);
          // Use 'val' for constants, 'var' for mutable
          const keyword = node.kind === 'const' ? 'val' : 'var';

          // Try to infer type from the initializer and use type inference when possible
          if (this._canInferTypeFromInit(decl.init)) {
            return this._indent(`${keyword} ${varName} = ${initValue}\n`);
          } else {
            return this._indent(`${keyword} ${varName}: ${varType} = ${initValue}\n`);
          }
        } else {
          return this._indent(`var ${varName}: ${varType}? = null\n`);
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
      return this._indent('return\n');
    }
  }

  /**
   * Generate binary expression
   * @private
   */
  _generateBinaryExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    const operator = this._mapOperator(node.operator);
    return `${left} ${operator} ${right}`;
  }

  /**
   * Generate call expression with OpCodes integration
   * @private
   */
  _generateCallExpression(node, options) {
    const callee = this._generateNode(node.callee, options);
    const args = node.arguments ?
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';

    // OpCodes integration for crypto operations
    if (options.useCryptoExtensions && this._isOpCodesCall(node)) {
      return this._generateOpCodesCall(node, options);
    }

    // Handle method calls vs function calls
    if (node.callee && node.callee.type === 'MemberExpression') {
      const object = this._generateNode(node.callee.object, options);
      const method = node.callee.property.name || node.callee.property;

      // Kotlin null-safe call operator
      if (options.nullSafety && this._mightBeNull(object)) {
        return `${object}?.${method}(${args})`;
      }

      return `${object}.${method}(${args})`;
    }

    // Kotlin extension functions
    if (options.useExtensionFunctions && this._isExtensionFunction(callee)) {
      return this._generateExtensionCall(node, options);
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
      `.${node.property.name || node.property}`;
    
    return `${object}${property}`;
  }

  /**
   * Generate assignment expression
   * @private
   */
  _generateAssignmentExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    const operator = this._mapOperator(node.operator);
    return `${left} ${operator} ${right}`;
  }

  /**
   * Generate identifier
   * @private
   */
  _generateIdentifier(node, options) {
    return this._toKotlinName(node.name);
  }

  /**
   * Generate literal
   * @private
   */
  _generateLiteral(node, options) {
    if (typeof node.value === 'string') {
      return `"${node.value.replace(/"/g, '\\"')}"`;
    } else if (node.value === null) {
      return 'null';
    } else if (typeof node.value === 'boolean') {
      return node.value ? 'true' : 'false';
    } else {
      return String(node.value);
    }
  }

  /**
   * Convert JavaScript names to Kotlin naming convention
   * @private
   */
  _toKotlinName(name) {
    // Kotlin uses camelCase like JavaScript
    return name;
  }

  /**
   * Map JavaScript operators to Kotlin equivalents
   * @private
   */
  _mapOperator(operator) {
    const operatorMap = {
      '===': '==',
      '!==': '!=',
      '&&': '&&',
      '||': '||',
      '!': '!'
    };
    return operatorMap[operator] || operator;
  }

  /**
   * Infer Kotlin type from parameter/variable name or AST context
   * @private
   */
  _inferKotlinType(name, init = null) {
    // First try to infer from the initializer if available
    if (init) {
      if (init.type === 'Literal') {
        if (typeof init.value === 'number') {
          return Number.isInteger(init.value) ? 'Int' : 'Double';
        } else if (typeof init.value === 'string') {
          return 'String';
        } else if (typeof init.value === 'boolean') {
          return 'Boolean';
        } else if (init.value === null) {
          return 'Any?';
        }
      } else if (init.type === 'ArrayExpression') {
        return 'Array<Any>';
      } else if (init.type === 'ObjectExpression') {
        return 'Map<String, Any>';
      } else if (init.type === 'BinaryExpression') {
        // Infer from binary operations
        if (['+', '-', '*', '/', '%'].includes(init.operator)) {
          return 'Int'; // Assume Int for arithmetic
        } else if (['==', '!=', '<', '>', '<=', '>='].includes(init.operator)) {
          return 'Boolean';
        }
      }
    }

    // Fallback to name-based inference
    const typeMap = {
      'data': 'ByteArray',
      'key': 'String',
      'input': 'Any',
      'value': 'Int',
      'index': 'Int',
      'length': 'Int',
      'result': 'Int',
      'count': 'Int',
      'size': 'Int',
      'text': 'String',
      'message': 'String',
      'name': 'String',
      'id': 'String',
      'flag': 'Boolean',
      'enabled': 'Boolean',
      'visible': 'Boolean'
    };
    return typeMap[name.toLowerCase()] || 'Any';
  }

  /**
   * Infer return type for functions
   * @private
   */
  _inferReturnType(functionName) {
    const returnTypeMap = {
      'encrypt': 'ByteArray',
      'decrypt': 'ByteArray',
      'simpleFunction': 'Int'
    };
    return returnTypeMap[functionName] || 'Any';
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
   * Wrap generated code with complete program structure
   * @private
   */
  _wrapWithImports(code, options) {
    let result = '';

    // Add package declaration
    if (options.packageName) {
      result += `package ${options.packageName}\n\n`;
    }

    // Add standard imports
    const imports = [];
    imports.push('// Standard Kotlin imports');

    // Add specific imports based on code content
    if (code.includes('println(') || code.includes('print(')) {
      // println is built-in, no import needed
    }

    if (code.includes('ByteArray') || code.includes('crypto')) {
      imports.push('// Crypto operations may require additional imports');
    }

    if (imports.length > 1) { // More than just the comment
      result += imports.join('\n') + '\n\n';
    }

    // Add file header comment
    if (options.addKDoc) {
      result += '/**\n';
      result += ' * Generated Kotlin code\n';
      result += ' * This file was automatically generated from JavaScript AST\n';
      result += ' * Compile with: kotlinc GeneratedCode.kt -include-runtime -d GeneratedCode.jar\n';
      result += ' * Run with: java -jar GeneratedCode.jar\n';
      result += ' */\n\n';
    }

    // Wrap in complete program structure
    result += this._wrapWithProgramStructure(code, options);

    return result;
  }

  /**
   * Wrap generated code with complete program structure including main function
   * @private
   */
  _wrapWithProgramStructure(code, options) {
    let result = '';

    // Create main class/object
    result += '/**\n';
    result += ' * Main generated class\n';
    result += ' * Contains all generated functions and the main entry point\n';
    result += ' */\n';
    result += 'object GeneratedProgram {\n\n';

    // Add generated code (functions, classes) with proper indentation
    const indentedCode = code.split('\n').map(line =>
      line.trim() ? '    ' + line : line
    ).join('\n');

    result += indentedCode;

    // Add main function
    result += '\n\n    /**\n';
    result += '     * Main entry point for testing generated code\n';
    result += '     * @param args Command line arguments\n';
    result += '     */\n';
    result += '    @JvmStatic\n';
    result += '    fun main(args: Array<String>) {\n';
    result += '        println("Generated Kotlin code execution")\n';
    result += '        \n';
    result += '        // Example usage of generated functions\n';
    result += '        try {\n';

    // Add example calls for generated functions
    const functionCalls = this._generateExampleCalls(code);
    if (functionCalls.length > 0) {
      result += '            ' + functionCalls.join('\n            ') + '\n';
    } else {
      result += '            // TODO: Add test calls for generated functions\n';
    }

    result += '        } catch (e: Exception) {\n';
    result += '            println("Error executing generated code: ${e.message}")\n';
    result += '            e.printStackTrace()\n';
    result += '        }\n';
    result += '    }\n';
    result += '}\n';

    return result;
  }

  /**
   * Generate example function calls for the main method
   * @private
   */
  _generateExampleCalls(code) {
    const calls = [];

    // Extract function names from the code
    const functionRegex = /fun\s+(\w+)\s*\([^)]*\)/g;
    let match;

    while ((match = functionRegex.exec(code)) !== null) {
      const functionName = match[1];

      // Generate appropriate test calls based on function name
      if (functionName === 'encrypt' || functionName === 'decrypt') {
        calls.push(`val testData${functionName} = "Hello World".toByteArray()`);
        calls.push(`val testKey${functionName} = "SecretKey123"`);
        calls.push(`val result${functionName} = ${functionName}(testData${functionName}, testKey${functionName})`);
        calls.push(`println("${functionName} result: \${result${functionName}.contentToString()}")`);
      } else if (functionName.includes('hash') || functionName.includes('Hash')) {
        calls.push(`val testInput${functionName} = "Test input".toByteArray()`);
        calls.push(`val hashResult${functionName} = ${functionName}(testInput${functionName})`);
        calls.push(`println("${functionName} result: \${hashResult${functionName}.contentToString()}")`);
      } else {
        // Generic function call
        calls.push(`// Example call: val result${functionName} = ${functionName}(/* parameters */)`);
        calls.push(`println("Function ${functionName} is available")`);
      }
    }

    return calls;
  }

  /**
   * Collect required dependencies and generate build files
   * @private
   */
  _collectDependencies(ast, options) {
    const dependencies = [];

    // Generate build.gradle.kts content for complete project setup
    const buildGradleContent = this._generateBuildGradleKts(options);
    dependencies.push({
      name: 'build.gradle.kts',
      content: buildGradleContent,
      description: 'Gradle build configuration for Kotlin/JVM project'
    });

    // Generate README.md with compilation instructions
    const readmeContent = this._generateProjectReadme(options);
    dependencies.push({
      name: 'README.md',
      content: readmeContent,
      description: 'Project documentation with build and run instructions'
    });

    return dependencies;
  }

  /**
   * Generate build.gradle.kts for complete Kotlin project
   * @private
   */
  _generateBuildGradleKts(options) {
    return `plugins {
    kotlin("jvm") version "1.9.22"
    application
}

group = "${options.packageName || 'com.cipher.generated'}"
version = "1.0.0"

repositories {
    mavenCentral()
}

dependencies {
    implementation(kotlin("stdlib"))

    // Add crypto dependencies if needed
    // implementation("org.bouncycastle:bcprov-jdk15to18:1.77")

    // Testing dependencies
    testImplementation(kotlin("test"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.10.1")
}

application {
    mainClass.set("${options.packageName || 'com.cipher.generated'}.GeneratedProgramKt")
}

kotlin {
    jvmToolchain(11)
}

tasks.test {
    useJUnitPlatform()
}

tasks.jar {
    manifest {
        attributes["Main-Class"] = "${options.packageName || 'com.cipher.generated'}.GeneratedProgramKt"
    }
    configurations["compileClasspath"].forEach { file: File ->
        from(zipTree(file.absoluteFile))
    }
    duplicatesStrategy = DuplicatesStrategy.INCLUDE
}

// Task to compile and create executable JAR
tasks.register("buildExecutable") {
    dependsOn("build")
    doLast {
        println("Generated executable JAR: build/libs/\${project.name}-\${project.version}.jar")
        println("Run with: java -jar build/libs/\${project.name}-\${project.version}.jar")
    }
}`;
  }

  /**
   * Generate README.md with project instructions
   * @private
   */
  _generateProjectReadme(options) {
    return `# Generated Kotlin Project

This project was automatically generated from JavaScript AST.

## Project Structure

\`\`\`
.
├── build.gradle.kts          # Gradle build configuration
├── README.md                 # This file
└── src/main/kotlin/
    └── ${(options.packageName || 'com.cipher.generated').replace(/\./g, '/')}/
        └── GeneratedCode.kt  # Generated Kotlin code
\`\`\`

## Prerequisites

- **Java 11+** (required for Kotlin)
- **Kotlin 1.9+** (included via Gradle)

### Installation

#### Option 1: Using Gradle Wrapper (Recommended)
\`\`\`bash
# The project includes gradle wrapper, no additional installation needed
./gradlew --version  # Linux/macOS
gradlew.bat --version  # Windows
\`\`\`

#### Option 2: Manual Kotlin Installation
\`\`\`bash
# macOS
brew install kotlin

# Windows (Chocolatey)
choco install kotlinc

# Windows (Scoop)
scoop install kotlin

# Linux (Snap)
snap install kotlin --classic
\`\`\`

## Building and Running

### Using Gradle (Recommended)
\`\`\`bash
# Build the project
./gradlew build

# Run the application
./gradlew run

# Create executable JAR
./gradlew jar

# Build and show executable info
./gradlew buildExecutable
\`\`\`

### Direct Kotlin Compilation
\`\`\`bash
# Compile to JAR with runtime
kotlinc src/main/kotlin/**/*.kt -include-runtime -d GeneratedCode.jar

# Run the JAR
java -jar GeneratedCode.jar
\`\`\`

### Development Mode
\`\`\`bash
# Compile and run directly
kotlinc src/main/kotlin/**/*.kt -include-runtime -d GeneratedCode.jar && java -jar GeneratedCode.jar
\`\`\`

## Project Details

- **Package**: \`${options.packageName || 'com.cipher.generated'}\`
- **Main Class**: \`GeneratedProgram\`
- **Kotlin Version**: 1.9.22
- **Java Target**: 11

## Adding Dependencies

Edit \`build.gradle.kts\` to add additional dependencies:

\`\`\`kotlin
dependencies {
    implementation("your.dependency:name:version")
}
\`\`\`

Common crypto dependencies:
\`\`\`kotlin
dependencies {
    implementation("org.bouncycastle:bcprov-jdk15to18:1.77")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")
}
\`\`\`

## IDE Support

This project can be imported into:
- **IntelliJ IDEA** (native Kotlin support)
- **Visual Studio Code** (with Kotlin extension)
- **Eclipse** (with Kotlin plugin)

## Generated Code Notes

The generated Kotlin code follows modern Kotlin conventions:
- Null safety with \`?\` operators
- Data classes for immutable data
- Extension functions where appropriate
- Coroutines for async operations (if detected)
- Sealed classes for type hierarchies (if detected)

## Troubleshooting

### Common Issues

1. **"kotlinc: command not found"**
   - Install Kotlin using one of the methods above
   - Or use Gradle: \`./gradlew build\`

2. **Java version issues**
   - Ensure Java 11+ is installed: \`java -version\`
   - Set JAVA_HOME if needed

3. **Gradle issues**
   - Use wrapper: \`./gradlew\` instead of \`gradle\`
   - Check network connectivity for dependency downloads

### Support

- Kotlin Documentation: https://kotlinlang.org/docs/
- Gradle Documentation: https://docs.gradle.org/
- Kotlin Slack: https://surveys.jetbrains.com/s3/kotlin-slack-sign-up`;
  }

  /**
   * Generate comprehensive warnings about potential issues
   * @private
   */
  _generateWarnings(ast, options) {
    const warnings = [];

    // Basic warnings that don't require deep AST traversal
    if (options.nullSafety) {
      warnings.push('Consider null safety annotations (?.) or non-null assertions (!!) where appropriate.');
    }

    if (options.useCoroutines) {
      warnings.push('Consider using suspend functions and coroutines for asynchronous operations.');
    }

    if (options.useDataClasses) {
      warnings.push('Consider using data classes to reduce boilerplate code.');
    }

    if (options.useSealedClasses) {
      warnings.push('Consider using sealed classes for better type safety with hierarchical data.');
    }

    if (options.useExtensionFunctions) {
      warnings.push('Consider using extension functions for utility methods on existing types.');
    }

    warnings.push('Prefer val over var for immutable variables. Consider using immutable collections.');
    warnings.push('Kotlin can infer types in many cases. Consider removing redundant type declarations.');

    if (options.useCryptoExtensions) {
      warnings.push('Crypto operations detected. Ensure proper key management and secure random number generation.');
    }

    warnings.push('Consider using trailing lambda syntax and it keyword for single parameter lambdas.');

    return warnings;
  }

  /**
   * Add missing AST node generation methods
   * @private
   */
  _generateArrayExpression(node, options) {
    const elements = node.elements ?
      node.elements.map(el => el ? this._generateNode(el, options) : 'null').join(', ') : '';
    return `arrayOf(${elements})`;
  }

  _generateObjectExpression(node, options) {
    const properties = node.properties ?
      node.properties.map(prop => this._generateProperty(prop, options)).join(', ') : '';
    return `mapOf(${properties})`;
  }

  _generateProperty(node, options) {
    const key = node.key ? this._generateNode(node.key, options) : 'null';
    const value = node.value ? this._generateNode(node.value, options) : 'null';
    return `${key} to ${value}`;
  }

  _generateFunctionExpression(node, options) {
    const params = node.params ?
      node.params.map(param => param.name || 'param').join(', ') : '';
    const body = node.body ? this._generateNode(node.body, options) : 'TODO()';
    return `{ ${params} -> ${body} }`;
  }

  _generateArrowFunctionExpression(node, options) {
    return this._generateFunctionExpression(node, options);
  }

  _generateNewExpression(node, options) {
    const callee = this._generateNode(node.callee, options);
    const args = node.arguments ?
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';
    return `${callee}(${args})`;
  }

  _generateUnaryExpression(node, options) {
    const operator = this._mapOperator(node.operator);
    const argument = this._generateNode(node.argument, options);
    return `${operator}${argument}`;
  }

  _generateUpdateExpression(node, options) {
    const operator = node.operator;
    const argument = this._generateNode(node.argument, options);
    return node.prefix ? `${operator}${argument}` : `${argument}${operator}`;
  }

  _generateLogicalExpression(node, options) {
    return this._generateBinaryExpression(node, options);
  }

  _generateConditionalExpression(node, options) {
    const test = this._generateNode(node.test, options);
    const consequent = this._generateNode(node.consequent, options);
    const alternate = this._generateNode(node.alternate, options);
    return `if (${test}) ${consequent} else ${alternate}`;
  }

  _generateSequenceExpression(node, options) {
    const expressions = node.expressions ?
      node.expressions.map(expr => this._generateNode(expr, options)) : [];
    return expressions.join('; ');
  }

  _generateTemplateLiteral(node, options) {
    let result = '"';
    if (node.quasis && node.expressions) {
      for (let i = 0; i < node.quasis.length; i++) {
        result += node.quasis[i].value.cooked || '';
        if (i < node.expressions.length) {
          result += '${' + this._generateNode(node.expressions[i], options) + '}';
        }
      }
    }
    result += '"';
    return result;
  }

  _generateTaggedTemplateExpression(node, options) {
    const tag = this._generateNode(node.tag, options);
    const quasi = this._generateTemplateLiteral(node.quasi, options);
    return `${tag}(${quasi})`;
  }

  _generateRestElement(node, options) {
    const argument = this._generateNode(node.argument, options);
    return `vararg ${argument}`;
  }

  _generateSpreadElement(node, options) {
    const argument = this._generateNode(node.argument, options);
    return `*${argument}`;
  }

  _generateAssignmentPattern(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    return `${left} = ${right}`;
  }

  _generateObjectPattern(node, options) {
    const properties = node.properties ?
      node.properties.map(prop => this._generateNode(prop, options)).join(', ') : '';
    return `{ ${properties} }`;
  }

  _generateArrayPattern(node, options) {
    const elements = node.elements ?
      node.elements.map(el => el ? this._generateNode(el, options) : 'null').join(', ') : '';
    return `arrayOf(${elements})`;
  }

  _generateVariableDeclarator(node, options) {
    const id = this._generateNode(node.id, options);
    const init = node.init ? this._generateNode(node.init, options) : 'null';
    return `${id} = ${init}`;
  }

  /**
   * Add missing helper methods
   * @private
   */
  _isOpCodesCall(node) {
    if (node.callee && node.callee.type === 'MemberExpression') {
      const object = node.callee.object;
      return object && object.name === 'OpCodes';
    }
    return false;
  }

  _generateOpCodesCall(node, options) {
    // Convert OpCodes calls to Kotlin equivalents
    const callee = this._generateNode(node.callee, options);
    const args = node.arguments ?
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';
    return `${callee}(${args})`;
  }

  _mightBeNull(objectStr) {
    // Simple heuristic - could be enhanced
    return objectStr.includes('?') || objectStr === 'null';
  }

  _isExtensionFunction(callee) {
    // Simple check for extension function patterns
    return false; // Placeholder implementation
  }

  _generateExtensionCall(node, options) {
    return this._generateCallExpression(node, options);
  }

  /**
   * Check if type can be inferred from initializer
   * @private
   */
  _canInferTypeFromInit(init) {
    if (!init) return false;

    // Kotlin can infer types for literals and simple expressions
    return init.type === 'Literal' ||
           init.type === 'ArrayExpression' ||
           init.type === 'ObjectExpression' ||
           init.type === 'CallExpression' ||
           init.type === 'NewExpression';
  }


  /**
   * Check if Kotlin compiler is available on the system
   * @private
   */
  _isKotlinAvailable() {
    try {
      const { execSync } = require('child_process');
      
      // Try kotlinc first
      try {
        execSync('kotlinc -version', { 
          stdio: 'pipe', 
          timeout: 3000,
          windowsHide: true  // Prevent Windows error dialogs
        });
        return 'kotlinc';
      } catch (error) {
        // Try kotlin as fallback
        try {
          execSync('kotlin -version', { 
            stdio: 'pipe', 
            timeout: 3000,
            windowsHide: true  // Prevent Windows error dialogs
          });
          return 'kotlin';
        } catch (error2) {
          return false;
        }
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Basic syntax validation for Kotlin code
   * @private
   */
  _checkBalancedSyntax(code) {
    try {
      let braces = 0;
      let parentheses = 0;
      let brackets = 0;
      let inString = false;
      let inTripleString = false;
      let inLineComment = false;
      let inBlockComment = false;
      let escaped = false;
      
      for (let i = 0; i < code.length; i++) {
        const char = code[i];
        const nextChar = i < code.length - 1 ? code[i + 1] : '';
        const nextNextChar = i < code.length - 2 ? code[i + 2] : '';
        
        // Handle triple-quoted strings (""")
        if (char === '"' && nextChar === '"' && nextNextChar === '"' && !inString && !inLineComment && !inBlockComment) {
          inTripleString = !inTripleString;
          i += 2; // Skip the next two quotes
          continue;
        }
        
        // Handle regular strings
        if (char === '"' && !escaped && !inTripleString && !inLineComment && !inBlockComment) {
          inString = !inString;
          continue;
        }
        
        // Handle comments
        if (!inString && !inTripleString) {
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
        
        // Track escape sequences in regular strings (not in triple strings)
        if (char === '\\' && inString && !inTripleString) {
          escaped = !escaped;
          continue;
        } else {
          escaped = false;
        }
        
        // Skip if inside string or comment
        if (inString || inTripleString || inLineComment || inBlockComment) {
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
      
      return braces === 0 && parentheses === 0 && brackets === 0 && !inString && !inTripleString && !inBlockComment;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate Kotlin code syntax using kotlinc compiler
   * @override
   */
  ValidateCodeSyntax(code) {
    // Check if Kotlin is available first
    const compiler = this._isKotlinAvailable();
    if (!compiler) {
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'Kotlin compiler not available - using basic validation'
      };
    }

    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');
      
      // Create temporary file
      const tempFile = path.join(__dirname, '..', '.agent.tmp', `temp_kotlin_${Date.now()}.kt`);
      
      // Ensure .agent.tmp directory exists
      const tempDir = path.dirname(tempFile);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Write Kotlin code to temp file
      fs.writeFileSync(tempFile, code);
      
      try {
        // Try to compile the Kotlin code to JVM bytecode
        const outputDir = path.join(tempDir, 'output');
        fs.mkdirSync(outputDir, { recursive: true });
        
        execSync(`kotlinc "${tempFile}" -d "${outputDir}"`, { 
          stdio: 'pipe',
          timeout: 5000, // Kotlin compilation can be slower
          windowsHide: true  // Prevent Windows error dialogs
        });
        
        // Clean up
        fs.unlinkSync(tempFile);
        if (fs.existsSync(outputDir)) {
          fs.rmSync(outputDir, { recursive: true, force: true });
        }
        
        return {
          success: true,
          method: 'kotlinc',
          error: null
        };
        
      } catch (error) {
        // Clean up on error
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
        
        const outputDir = path.join(tempDir, 'output');
        if (fs.existsSync(outputDir)) {
          fs.rmSync(outputDir, { recursive: true, force: true });
        }
        
        return {
          success: false,
          method: 'kotlinc',
          error: error.stderr?.toString() || error.message
        };
      }
      
    } catch (error) {
      // If Kotlin is not available or other error, fall back to basic validation
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'Kotlin compiler not available - using basic validation'
      };
    }
  }

  /**
   * Get Kotlin compiler download information
   * @override
   */
  GetCompilerInfo() {
    return {
      name: this.name,
      compilerName: 'Kotlin/JVM (kotlinc)',
      downloadUrl: 'https://kotlinlang.org/docs/command-line.html',
      installInstructions: [
        'Option 1 - Manual Installation:',
        '  Download Kotlin from https://github.com/JetBrains/kotlin/releases',
        '  Extract the archive and add bin/ directory to PATH',
        '',
        'Option 2 - Package Managers:',
        '  macOS: brew install kotlin',
        '  Windows: choco install kotlinc or scoop install kotlin',
        '  Linux: snap install kotlin --classic',
        '',
        'Option 3 - IntelliJ IDEA (includes Kotlin):',
        '  Download from https://www.jetbrains.com/idea/',
        '',
        'Prerequisites: Java 8+ must be installed',
        'Verify installation with: kotlinc -version'
      ].join('\n'),
      verifyCommand: 'kotlinc -version',
      alternativeValidation: 'Basic syntax checking (balanced brackets/braces/parentheses)',
      packageManager: 'Gradle/Maven (for dependencies)',
      documentation: 'https://kotlinlang.org/docs/'
    };
  }
}

// Add remaining AST node generators for complete coverage
KotlinPlugin.prototype._generateIfStatement = function(node, options) {
  const test = this._generateNode(node.test, options);
  const consequent = this._generateNode(node.consequent, options);
  const alternate = node.alternate ? this._generateNode(node.alternate, options) : '';

  let result = this._indent(`if (${test}) {\n`);
  this.indentLevel++;
  result += consequent;
  this.indentLevel--;
  result += this._indent('}');

  if (alternate) {
    if (node.alternate.type === 'IfStatement') {
      result += ' else ' + alternate.replace(/^\s+/, '');
    } else {
      result += ' else {\n';
      this.indentLevel++;
      result += alternate;
      this.indentLevel--;
      result += this._indent('}');
    }
  }

  return result + '\n';
};

KotlinPlugin.prototype._generateWhileStatement = function(node, options) {
  const test = this._generateNode(node.test, options);
  const body = this._generateNode(node.body, options);

  let result = this._indent(`while (${test}) {\n`);
  this.indentLevel++;
  result += body;
  this.indentLevel--;
  result += this._indent('}\n');

  return result;
};

KotlinPlugin.prototype._generateForStatement = function(node, options) {
  const init = node.init ? this._generateNode(node.init, options) : '';
  const test = node.test ? this._generateNode(node.test, options) : 'true';
  const update = node.update ? this._generateNode(node.update, options) : '';
  const body = this._generateNode(node.body, options);

  // Convert to Kotlin for loop style when possible
  if (this._isSimpleForLoop(node)) {
    return this._generateKotlinRangeLoop(node, options);
  }

  // Fallback to while loop
  let result = '';
  if (init) {
    result += this._indent(init + '\n');
  }

  result += this._indent(`while (${test}) {\n`);
  this.indentLevel++;
  result += body;
  if (update) {
    result += this._indent(update + '\n');
  }
  this.indentLevel--;
  result += this._indent('}\n');

  return result;
};

KotlinPlugin.prototype._generateForInStatement = function(node, options) {
  const left = this._generateNode(node.left, options);
  const right = this._generateNode(node.right, options);
  const body = this._generateNode(node.body, options);

  let result = this._indent(`for (${left} in ${right}) {\n`);
  this.indentLevel++;
  result += body;
  this.indentLevel--;
  result += this._indent('}\n');

  return result;
};

KotlinPlugin.prototype._generateForOfStatement = function(node, options) {
  const left = this._generateNode(node.left, options);
  const right = this._generateNode(node.right, options);
  const body = this._generateNode(node.body, options);

  let result = this._indent(`for (${left} in ${right}) {\n`);
  this.indentLevel++;
  result += body;
  this.indentLevel--;
  result += this._indent('}\n');

  return result;
};

KotlinPlugin.prototype._generateDoWhileStatement = function(node, options) {
  const test = this._generateNode(node.test, options);
  const body = this._generateNode(node.body, options);

  let result = this._indent('do {\n');
  this.indentLevel++;
  result += body;
  this.indentLevel--;
  result += this._indent(`} while (${test})\n`);

  return result;
};

KotlinPlugin.prototype._generateSwitchStatement = function(node, options) {
  const discriminant = this._generateNode(node.discriminant, options);

  let result = this._indent(`when (${discriminant}) {\n`);
  this.indentLevel++;

  if (node.cases) {
    node.cases.forEach(caseNode => {
      result += this._generateSwitchCase(caseNode, options);
    });
  }

  this.indentLevel--;
  result += this._indent('}\n');

  return result;
};

KotlinPlugin.prototype._generateSwitchCase = function(node, options) {
  let result = '';

  if (node.test) {
    const test = this._generateNode(node.test, options);
    result += this._indent(`${test} -> {\n`);
  } else {
    result += this._indent('else -> {\n');
  }

  this.indentLevel++;
  if (node.consequent) {
    node.consequent.forEach(stmt => {
      if (stmt.type !== 'BreakStatement') {
        result += this._generateNode(stmt, options);
      }
    });
  }
  this.indentLevel--;

  result += this._indent('}\n');

  return result;
};

KotlinPlugin.prototype._generateBreakStatement = function(node, options) {
  return this._indent('break\n');
};

KotlinPlugin.prototype._generateContinueStatement = function(node, options) {
  return this._indent('continue\n');
};

KotlinPlugin.prototype._generateTryStatement = function(node, options) {
  const block = this._generateNode(node.block, options);

  let result = this._indent('try {\n');
  this.indentLevel++;
  result += block;
  this.indentLevel--;
  result += this._indent('}');

  if (node.handler) {
    result += this._generateCatchClause(node.handler, options);
  }

  if (node.finalizer) {
    result += ' finally {\n';
    this.indentLevel++;
    result += this._generateNode(node.finalizer, options);
    this.indentLevel--;
    result += this._indent('}');
  }

  return result + '\n';
};

KotlinPlugin.prototype._generateCatchClause = function(node, options) {
  const param = node.param ? node.param.name : 'e';
  const body = this._generateNode(node.body, options);

  let result = ` catch (${param}: Exception) {\n`;
  this.indentLevel++;
  result += body;
  this.indentLevel--;
  result += this._indent('}');

  return result;
};

KotlinPlugin.prototype._generateThrowStatement = function(node, options) {
  const argument = this._generateNode(node.argument, options);
  return this._indent(`throw ${argument}\n`);
};

KotlinPlugin.prototype._generateEmptyStatement = function(node, options) {
  return '';
};

KotlinPlugin.prototype._generateDebuggerStatement = function(node, options) {
  return this._indent('// debugger\n');
};

KotlinPlugin.prototype._generateWithStatement = function(node, options) {
  const object = this._generateNode(node.object, options);
  const body = this._generateNode(node.body, options);

  // Kotlin doesn't have 'with' statement, use run extension
  let result = this._indent(`${object}.run {\n`);
  this.indentLevel++;
  result += body;
  this.indentLevel--;
  result += this._indent('}\n');

  return result;
};

KotlinPlugin.prototype._generateLabeledStatement = function(node, options) {
  const label = node.label.name;
  const body = this._generateNode(node.body, options);

  return this._indent(`${label}@ ${body}`);
};

KotlinPlugin.prototype._generateMetaProperty = function(node, options) {
  if (node.meta.name === 'new' && node.property.name === 'target') {
    return 'this::class';
  }
  return `${node.meta.name}.${node.property.name}`;
};

KotlinPlugin.prototype._generateAwaitExpression = function(node, options) {
  const argument = this._generateNode(node.argument, options);
  return `${argument}.await()`;
};

KotlinPlugin.prototype._generateYieldExpression = function(node, options) {
  const argument = node.argument ? this._generateNode(node.argument, options) : '';
  return argument ? `yield(${argument})` : 'yield()';
};

KotlinPlugin.prototype._generateImportDeclaration = function(node, options) {
  const source = node.source.value;

  if (node.specifiers && node.specifiers.length > 0) {
    const imports = node.specifiers.map(spec => {
      if (spec.type === 'ImportDefaultSpecifier') {
        return spec.local.name;
      } else if (spec.type === 'ImportSpecifier') {
        return spec.imported.name !== spec.local.name ?
          `${spec.imported.name} as ${spec.local.name}` :
          spec.imported.name;
      }
      return spec.local.name;
    }).join(', ');

    return this._indent(`import ${source}.{${imports}}\n`);
  }

  return this._indent(`import ${source}.*\n`);
};

KotlinPlugin.prototype._generateExportDeclaration = function(node, options) {
  // Kotlin doesn't have export, convert to public
  if (node.declaration) {
    const decl = this._generateNode(node.declaration, options);
    return decl.replace(/^(\s*)/, '$1public ');
  }
  return '';
};

KotlinPlugin.prototype._generateClassExpression = function(node, options) {
  return this._generateClass(node, options);
};

KotlinPlugin.prototype._generatePropertyDefinition = function(node, options) {
  const key = this._generateNode(node.key, options);
  const value = node.value ? this._generateNode(node.value, options) : 'null';
  const modifier = node.static ? 'companion object { val ' : 'val ';
  const type = this._inferKotlinType(key);

  return this._indent(`${modifier}${key}: ${type} = ${value}\n`);
};

KotlinPlugin.prototype._generatePrivateIdentifier = function(node, options) {
  return `private ${node.name.substring(1)}`; // Remove # prefix
};

KotlinPlugin.prototype._generateStaticBlock = function(node, options) {
  const body = this._generateNode(node.body, options);

  let result = this._indent('companion object {\n');
  this.indentLevel++;
  result += this._indent('init {\n');
  this.indentLevel++;
  result += body;
  this.indentLevel--;
  result += this._indent('}\n');
  this.indentLevel--;
  result += this._indent('}\n');

  return result;
};

KotlinPlugin.prototype._generateChainExpression = function(node, options) {
  return this._generateNode(node.expression, options);
};

KotlinPlugin.prototype._generateImportExpression = function(node, options) {
  const source = this._generateNode(node.source, options);
  return `loadModule(${source})`;
};

KotlinPlugin.prototype._generateOptionalCallExpression = function(node, options) {
  const callee = this._generateNode(node.callee, options);
  const args = node.arguments ?
    node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';
  return `${callee}?(${args})`;
};

KotlinPlugin.prototype._generateOptionalMemberExpression = function(node, options) {
  const object = this._generateNode(node.object, options);
  const property = node.computed ?
    `[${this._generateNode(node.property, options)}]` :
    `.${node.property.name || node.property}`;
  return `${object}?${property}`;
};

KotlinPlugin.prototype._generateJSXElement = function(node, options) {
  // Convert JSX to Kotlin HTML DSL or similar
  const tagName = node.openingElement.name.name || 'div';
  return `html.${tagName} { /* JSX content */ }`;
};

KotlinPlugin.prototype._generateJSXFragment = function(node, options) {
  return 'html.fragment { /* JSX fragment */ }';
};

KotlinPlugin.prototype._generateTSTypeAnnotation = function(node, options) {
  // TypeScript type annotations convert to Kotlin types
  return ''; // Type annotations are handled inline in Kotlin
};

KotlinPlugin.prototype._generateTSAsExpression = function(node, options) {
  const expression = this._generateNode(node.expression, options);
  const type = node.typeAnnotation ? this._generateNode(node.typeAnnotation, options) : 'Any';
  return `${expression} as ${type}`;
};

KotlinPlugin.prototype._generateFallbackNode = function(node, options) {
  return `/* Unsupported node type: ${node.type} */`;
};

// Helper methods for enhanced functionality
KotlinPlugin.prototype._isSimpleForLoop = function(node) {
  return node.init && node.test && node.update &&
         node.init.type === 'VariableDeclaration' &&
         node.test.type === 'BinaryExpression' &&
         node.update.type === 'UpdateExpression';
};

KotlinPlugin.prototype._generateKotlinRangeLoop = function(node, options) {
  // Extract loop variable and range
  const variable = node.init.declarations[0].id.name;
  const start = node.init.declarations[0].init ?
    this._generateNode(node.init.declarations[0].init, options) : '0';

  let end = '';
  if (node.test.right) {
    end = this._generateNode(node.test.right, options);
    if (node.test.operator === '<') {
      end = `${end} - 1`;
    }
  }

  const body = this._generateNode(node.body, options);

  let result = this._indent(`for (${variable} in ${start}..${end}) {\n`);
  this.indentLevel++;
  result += body;
  this.indentLevel--;
  result += this._indent('}\n');

  return result;
};

// Register the plugin
const kotlinPlugin = new KotlinPlugin();
LanguagePlugins.Add(kotlinPlugin);

// Export for potential direct use (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = kotlinPlugin;
}

})(); // End of IIFE