/**
 * Go Language Plugin for Multi-Language Code Generation
 * Generates Go code from JavaScript AST
 * 
 * Follows the LanguagePlugin specification exactly
 */

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
 * Go Code Generator Plugin
 * Extends LanguagePlugin base class
 */
class GoPlugin extends LanguagePlugin {
  constructor() {
    super();
    
    // Required plugin metadata
    this.name = 'Go';
    this.extension = 'go';
    this.icon = '🐹';
    this.description = 'Go language code generator';
    this.mimeType = 'text/x-go';
    this.version = '1.21+';
    
    // Go-specific options
    this.options = {
      indent: '\t', // Go uses tabs by convention
      lineEnding: '\n',
      packageName: 'main',
      addComments: true,
      useStrictTypes: true,
      errorHandling: true,
      useInterfaces: true,
      useGoroutines: true,
      useCrypto: true,
      useGenerics: true, // Go 1.18+
      useContext: true,
      useChannels: true
    };
    
    // Internal state
    this.indentLevel = 0;
    this.imports = new Set();
  }

  /**
   * Generate Go code from Abstract Syntax Tree
   * @param {Object} ast - Parsed/Modified AST representation
   * @param {Object} options - Generation options
   * @returns {CodeGenerationResult}
   */
  GenerateFromAST(ast, options = {}) {
    try {
      // Reset state for clean generation
      this.indentLevel = 0;
      this.imports.clear();
      
      // Merge options
      const mergedOptions = { ...this.options, ...options };
      
      // Validate AST
      if (!ast || typeof ast !== 'object') {
        return this.CreateErrorResult('Invalid AST: must be an object');
      }
      
      // Generate Go code
      const code = this._generateNode(ast, mergedOptions);
      
      // Add package declaration and imports
      const finalCode = this._wrapWithPackageAndImports(code, mergedOptions);
      
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
        return 'this'; // Go doesn't have 'this', use receiver context
      case 'Super':
        return 'super'; // Go doesn't have inheritance
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
      case 'ClassDeclaration':
        return this._generateStructDeclaration(node, options);
      case 'MethodDefinition':
        return this._generateMethodDefinition(node, options);
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
    const functionName = node.id ? this._capitalizeFirst(node.id.name) : 'UnnamedFunction';
    let code = '';
    
    // Go doc comment
    if (options.addComments) {
      code += this._indent(`// ${functionName} performs the ${node.id ? node.id.name : 'unnamed'} operation\n`);
    }
    
    // Function signature
    code += this._indent(`func ${functionName}(`);
    
    // Parameters with Go types
    if (node.params && node.params.length > 0) {
      const params = node.params.map(param => {
        const paramName = param.name || 'param';
        return `${paramName} interface{}`; // Use interface{} for generic type
      });
      code += params.join(', ');
    }
    
    // Return type (infer from context or use interface{})
    code += ') interface{} {\n';
    
    // Function body
    this.indentLevel++;
    if (node.body) {
      const bodyCode = this._generateNode(node.body, options);
      // Empty body is valid in Go
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
   * Generate block statement
   * @private
   */
  _generateBlock(node, options) {
    if (!node.body || node.body.length === 0) {
      return this._indent('panic("Empty block")\n');
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
        
        if (decl.init) {
          const initValue = this._generateNode(decl.init, options);
          // Use := for short variable declaration in Go
          return this._indent(`${varName} := ${initValue}\n`);
        } else {
          // Use var declaration with zero value
          return this._indent(`var ${varName} interface{}\n`);
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
      return this._indent('return nil\n');
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
    
    // Handle type conversions for arithmetic operations
    if (['+', '-', '*', '/', '%'].includes(operator)) {
      // In Go, we might need type assertions for interface{} operations
      return `${left}.(int) ${operator} ${right}.(int)`;
    }
    
    return `${left} ${operator} ${right}`;
  }

  /**
   * Generate call expression with Go patterns
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
          return `${object} = append(${object}, ${args})`;
        case 'pop':
          return `func() interface{} { if len(${object}) == 0 { return nil }; val := ${object}[len(${object})-1]; ${object} = ${object}[:len(${object})-1]; return val }()`;
        case 'length':
          return `len(${object})`;
        case 'charAt':
          return `string(${object}[${args}])`;
        case 'charCodeAt':
          return `int(${object}[${args}])`;
        case 'substring':
        case 'substr':
          return `${object}[${args}]`;
        case 'indexOf':
          this.imports.add('strings');
          return `strings.Index(${object}, ${args})`;
        case 'toUpperCase':
          this.imports.add('strings');
          return `strings.ToUpper(${object})`;
        case 'toLowerCase':
          this.imports.add('strings');
          return `strings.ToLower(${object})`;
        case 'split':
          this.imports.add('strings');
          return `strings.Split(${object}, ${args})`;
        case 'join':
          this.imports.add('strings');
          return `strings.Join(${object}, ${args})`;
        case 'slice':
          return `${object}[${args}]`;
        case 'toString':
          this.imports.add('fmt');
          return `fmt.Sprintf("%v", ${object})`;
        case 'map':
          return `func() []interface{} { result := make([]interface{}, len(${object})); for i, v := range ${object} { result[i] = ${args}(v) }; return result }()`;
        case 'filter':
          return `func() []interface{} { var result []interface{}; for _, v := range ${object} { if ${args}(v) { result = append(result, v) } }; return result }()`;
        case 'reduce':
          return `func() interface{} { result := ${args}; for _, v := range ${object}[1:] { result = ${args}(result, v) }; return result }()`;
        case 'forEach':
          return `for _, v := range ${object} { ${args}(v) }`;
        default:
          return `${callee}(${args})`;
      }
    }

    // Handle constructor calls
    if (node.callee.type === 'Identifier') {
      switch (node.callee.name) {
        case 'Array':
          return `make([]interface{}, ${args || 0})`;
        case 'Object':
          return 'make(map[string]interface{})';
        case 'String':
          return `string(${args})`;
        case 'Number':
          this.imports.add('strconv');
          return `strconv.ParseFloat(${args}, 64)`;
        case 'BigInt':
          this.imports.add('math/big');
          return `big.NewInt(${args})`;
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
      `[${this._generateNode(node.property, options)}]` : 
      `.${this._capitalizeFirst(node.property.name || node.property)}`;
    
    return `${object}${property}`;
  }

  /**
   * Generate assignment expression
   * @private
   */
  _generateAssignmentExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    const operator = node.operator;
    return `${left} ${operator} ${right}`;
  }

  /**
   * Generate identifier
   * @private
   */
  _generateIdentifier(node, options) {
    // Go naming conventions: exported names start with uppercase
    return node.name;
  }

  /**
   * Generate literal
   * @private
   */
  _generateLiteral(node, options) {
    if (typeof node.value === 'string') {
      return `"${node.value.replace(/"/g, '\\"')}"`;
    } else if (node.value === null) {
      return 'nil';
    } else if (typeof node.value === 'boolean') {
      return node.value ? 'true' : 'false';
    } else {
      return String(node.value);
    }
  }

  /**
   * Generate array expression
   * @private
   */
  _generateArrayExpression(node, options) {
    if (!node.elements) {
      return '[]interface{}{}';
    }

    const elements = node.elements.map(element => {
      if (element === null) {
        return 'nil';
      }
      return this._generateNode(element, options);
    });

    return `[]interface{}{${elements.join(', ')}}`;
  }

  /**
   * Generate object expression
   * @private
   */
  _generateObjectExpression(node, options) {
    if (!node.properties || node.properties.length === 0) {
      return 'map[string]interface{}{}';
    }

    const properties = node.properties.map(prop => {
      return this._generateNode(prop, options);
    });

    return `map[string]interface{}{${properties.join(', ')}}`;
  }

  /**
   * Generate property (for object literals)
   * @private
   */
  _generateProperty(node, options) {
    const key = node.key ? this._generateNode(node.key, options) : 'unknown';
    const value = node.value ? this._generateNode(node.value, options) : 'nil';

    // For string keys, ensure they're quoted
    const quotedKey = node.key && node.key.type === 'Identifier' ? `"${key}"` : key;

    return `${quotedKey}: ${value}`;
  }

  /**
   * Generate variable declarator
   * @private
   */
  _generateVariableDeclarator(node, options) {
    const varName = node.id ? node.id.name : 'variable';

    if (node.init) {
      const initValue = this._generateNode(node.init, options);
      return `${varName} := ${initValue}`;
    } else {
      return `var ${varName} interface{}`;
    }
  }

  /**
   * Generate if statement
   * @private
   */
  _generateIfStatement(node, options) {
    const test = this._generateNode(node.test, options);
    let code = this._indent(`if ${test} {\n`);

    this.indentLevel++;
    if (node.consequent) {
      const consequent = this._generateNode(node.consequent, options);
      code += consequent;
    }
    this.indentLevel--;

    code += this._indent('}\n');

    if (node.alternate) {
      if (node.alternate.type === 'IfStatement') {
        // Handle else if
        code += this._indent('} else ');
        code += this._generateIfStatement(node.alternate, options);
      } else {
        // Handle else
        code += this._indent('} else {\n');
        this.indentLevel++;
        const alternate = this._generateNode(node.alternate, options);
        code += alternate;
        this.indentLevel--;
        code += this._indent('}\n');
      }
    }

    return code;
  }

  /**
   * Capitalize first letter (Go convention for exported functions)
   * @private
   */
  _capitalizeFirst(str) {
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
   * Wrap generated code with complete program structure including main function
   * @private
   */
  _wrapWithPackageAndImports(code, options) {
    let result = `package ${options.packageName}\n\n`;

    // Always add basic imports for complete programs
    this.imports.add('fmt');
    this.imports.add('os');

    // Add imports if any were collected
    if (this.imports.size > 0) {
      if (this.imports.size === 1) {
        result += `import "${Array.from(this.imports)[0]}"\n\n`;
      } else {
        result += 'import (\n';
        for (const imp of this.imports) {
          result += `\t"${imp}"\n`;
        }
        result += ')\n\n';
      }
    }

    // Add program structure with main function
    result += this._wrapWithProgramStructure(code, options);

    return result;
  }

  /**
   * Wrap generated code with complete program structure including main function
   * @private
   */
  _wrapWithProgramStructure(code, options) {
    let result = '';

    // Add file header comment
    if (options.addComments) {
      result += '// Generated Go code\n';
      result += '// This file was automatically generated from JavaScript AST\n';
      result += '// Build with: go build\n';
      result += '// Run with: go run main.go\n\n';
    }

    // Add generated code (functions, structs, etc.)
    result += code;

    // Add main function for executable program
    result += '\n\n';
    result += '// main is the entry point for the generated program\n';
    result += 'func main() {\n';
    result += '\tfmt.Println("Generated Go code execution")\n';
    result += '\t\n';
    result += '\t// Example usage of generated functions\n';

    // Add example calls for generated functions
    const functionCalls = this._generateExampleCalls(code);
    if (functionCalls.length > 0) {
      result += '\t' + functionCalls.join('\n\t') + '\n';
    } else {
      result += '\t// TODO: Add test calls for generated functions\n';
    }

    result += '}\n';

    return result;
  }

  /**
   * Generate example function calls for the main method
   * @private
   */
  _generateExampleCalls(code) {
    const calls = [];

    // Extract function names from the generated code
    const functionRegex = /func\s+(\w+)\s*\([^)]*\)/g;
    let match;

    while ((match = functionRegex.exec(code)) !== null) {
      const functionName = match[1];

      // Skip the main function itself
      if (functionName === 'main') continue;

      // Generate appropriate test calls based on function name
      if (functionName.toLowerCase().includes('encrypt') || functionName.toLowerCase().includes('decrypt')) {
        calls.push(`testData${functionName} := []byte("Hello World")`);
        calls.push(`testKey${functionName} := []byte("SecretKey123")`);
        calls.push(`result${functionName} := ${functionName}(testData${functionName}, testKey${functionName})`);
        calls.push(`fmt.Printf("${functionName} result: %v\\n", result${functionName})`);
      } else if (functionName.toLowerCase().includes('hash')) {
        calls.push(`testInput${functionName} := []byte("Test input")`);
        calls.push(`hashResult${functionName} := ${functionName}(testInput${functionName})`);
        calls.push(`fmt.Printf("${functionName} result: %v\\n", hashResult${functionName})`);
      } else {
        // Generic function call with basic parameters
        calls.push(`// Example call: result${functionName} := ${functionName}(/* parameters */)`);
        calls.push(`fmt.Printf("Function ${functionName} is available\\n")`);
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

    // Generate go.mod file for proper module management
    const goModContent = this._generateGoMod(options);
    dependencies.push({
      name: 'go.mod',
      content: goModContent,
      description: 'Go module file for dependency management'
    });

    // Generate README.md with compilation and usage instructions
    const readmeContent = this._generateProjectReadme(options);
    dependencies.push({
      name: 'README.md',
      content: readmeContent,
      description: 'Project documentation with build and run instructions'
    });

    // Generate .gitignore for Go projects
    const gitignoreContent = this._generateGitignore();
    dependencies.push({
      name: '.gitignore',
      content: gitignoreContent,
      description: 'Git ignore file for Go projects'
    });

    return dependencies;
  }

  /**
   * Generate go.mod file content
   * @private
   */
  _generateGoMod(options) {
    const moduleName = options.moduleName || 'generated-go-code';
    const goVersion = options.goVersion || '1.21';

    return `module ${moduleName}

go ${goVersion}

// Dependencies will be added here automatically when you run:
// go mod tidy
`;
  }

  /**
   * Generate README.md with build instructions
   * @private
   */
  _generateProjectReadme(options) {
    const moduleName = options.moduleName || 'generated-go-code';

    return `# ${moduleName}

This is an automatically generated Go program from JavaScript AST.

## Prerequisites

- Go ${options.goVersion || '1.21'}+ installed
- Basic familiarity with Go development

## Building and Running

### Quick Start

\`\`\`bash
# Build and run in one step
go run main.go
\`\`\`

### Build Executable

\`\`\`bash
# Build executable
go build -o ${moduleName}

# Run executable (Windows)
.\\${moduleName}.exe

# Run executable (Linux/macOS)
./${moduleName}
\`\`\`

### Development

\`\`\`bash
# Initialize module (if needed)
go mod init ${moduleName}

# Download dependencies
go mod tidy

# Run tests (if any)
go test ./...

# Format code
go fmt ./...

# Vet code for issues
go vet ./...
\`\`\`

## Project Structure

- \`main.go\` - Main program file with generated functions
- \`go.mod\` - Go module definition
- \`README.md\` - This documentation file

## Generated Functions

The main.go file contains:
- Generated functions from the original JavaScript AST
- A main() function that demonstrates usage
- Proper Go idioms and error handling

## Customization

You can modify the generated code to:
- Add proper type definitions instead of \`interface{}\`
- Implement error handling
- Add unit tests
- Optimize for performance

## Resources

- [Go Documentation](https://golang.org/doc/)
- [Go by Example](https://gobyexample.com/)
- [Effective Go](https://golang.org/doc/effective_go.html)
`;
  }

  /**
   * Generate .gitignore file for Go projects
   * @private
   */
  _generateGitignore() {
    return `# Binaries for programs and plugins
*.exe
*.exe~
*.dll
*.so
*.dylib

# Test binary, built with \`go test -c\`
*.test

# Output of the go coverage tool, specifically when used with LiteIDE
*.out

# Dependency directories (remove the comment below to include it)
# vendor/

# Go workspace file
go.work

# IDE specific files
.vscode/
.idea/
*.swp
*.swo
*~

# OS specific files
.DS_Store
Thumbs.db
`;
  }

  /**
   * Generate warnings about potential issues
   * @private
   */
  _generateWarnings(ast, options) {
    const warnings = [];

    // Go-specific warnings
    warnings.push('Consider adding proper error handling');
    warnings.push('Replace interface{} with specific types for better performance');
    warnings.push('Add unit tests using the testing package');

    return warnings;
  }

  /**
   * Generate OpCodes method call with Go crypto optimizations
   * @private
   */
  _generateOpCodesCall(methodName, args) {
    // Map OpCodes methods to Go crypto equivalents
    switch (methodName) {
      case 'Pack32LE':
        this.imports.add('encoding/binary');
        return `binary.LittleEndian.PutUint32(buf, ${args})`;
      case 'Pack32BE':
        this.imports.add('encoding/binary');
        return `binary.BigEndian.PutUint32(buf, ${args})`;
      case 'Unpack32LE':
        this.imports.add('encoding/binary');
        return `binary.LittleEndian.Uint32(${args})`;
      case 'Unpack32BE':
        this.imports.add('encoding/binary');
        return `binary.BigEndian.Uint32(${args})`;
      case 'RotL32':
        this.imports.add('math/bits');
        return `bits.RotateLeft32(${args})`;
      case 'RotR32':
        this.imports.add('math/bits');
        return `bits.RotateLeft32(value, -${args})`;
      case 'XorArrays':
        return `xorArrays(${args})`; // Custom utility function
      case 'ClearArray':
        return `clear(${args})`; // Go 1.21+
      case 'Hex8ToBytes':
        this.imports.add('encoding/hex');
        return `hex.DecodeString(${args})`;
      case 'BytesToHex8':
        this.imports.add('encoding/hex');
        return `hex.EncodeToString(${args})`;
      case 'AnsiToBytes':
        return `[]byte(${args})`;
      default:
        return `opcodes.${methodName}(${args})`;
    }
  }

  /**
   * Infer Go type from JavaScript AST value with crypto context
   * @private
   */
  _inferGoType(node, context = {}) {
    if (!node) return 'interface{}';

    switch (node.type) {
      case 'Literal':
        if (typeof node.value === 'string') return 'string';
        if (typeof node.value === 'number') {
          if (Number.isInteger(node.value)) {
            return node.value >= 0 && node.value <= 255 ? 'uint8' :
                   node.value >= 0 && node.value <= 65535 ? 'uint16' :
                   node.value >= 0 ? 'uint32' : 'int32';
          }
          return 'float64';
        }
        if (typeof node.value === 'boolean') return 'bool';
        if (node.value === null) return '*interface{}';
        break;
      case 'ArrayExpression':
        if (node.elements && node.elements.length > 0) {
          const firstElement = node.elements.find(el => el !== null);
          if (firstElement && this._isLikelyByteValue(firstElement)) {
            return `[${node.elements.length}]byte`;
          }
          const elementType = this._inferGoType(firstElement, context);
          return `[]${elementType}`;
        }
        return context.isCryptographic ? '[]byte' : '[]int';
      case 'ObjectExpression':
        return context.isCryptographic ? 'map[string]uint32' : 'map[string]interface{}';
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        return 'func() interface{}';
    }

    // Crypto-specific type inference
    if (context.isCryptographic) {
      if (context.isKey) return '[]byte';
      if (context.isIV) return '[16]byte';
      if (context.isState) return '[16]uint32';
      return 'uint32';
    }

    return 'interface{}';
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
   * Generate Go interfaces for crypto operations
   * @private
   */
  _generateCryptoInterfaces(options) {
    let interfaces = '';

    // Crypto key interface
    interfaces += '// CryptoKey represents a cryptographic key\n';
    interfaces += 'type CryptoKey interface {\n';
    interfaces += '\tBytes() []byte\n';
    interfaces += '\tSize() int\n';
    interfaces += '\tString() string\n';
    interfaces += '}\n\n';

    // Block cipher interface
    interfaces += '// BlockCipher represents a block cipher\n';
    interfaces += 'type BlockCipher interface {\n';
    interfaces += '\tBlockSize() int\n';
    interfaces += '\tEncrypt(dst, src []byte)\n';
    interfaces += '\tDecrypt(dst, src []byte)\n';
    interfaces += '}\n\n';

    // Hash function interface
    interfaces += '// HashFunction represents a hash function\n';
    interfaces += 'type HashFunction interface {\n';
    interfaces += '\tWrite([]byte) (int, error)\n';
    interfaces += '\tSum([]byte) []byte\n';
    interfaces += '\tReset()\n';
    interfaces += '\tSize() int\n';
    interfaces += '\tBlockSize() int\n';
    interfaces += '}\n\n';

    // AEAD interface (standard crypto interface)
    this.imports.add('crypto/cipher');
    interfaces += '// AEAD combines encryption and authentication\n';
    interfaces += 'type AEAD interface {\n';
    interfaces += '\tcipher.AEAD\n';
    interfaces += '}\n\n';

    return interfaces;
  }

  /**
   * Generate Go crypto utilities with goroutines
   * @private
   */
  _generateCryptoUtilities(options) {
    let utilities = '';

    // Parallel processing with goroutines
    if (options.useGoroutines) {
      this.imports.add('sync');
      this.imports.add('runtime');

      utilities += '// ProcessBlocksParallel processes blocks in parallel using goroutines\n';
      utilities += 'func ProcessBlocksParallel(blocks [][]byte, processor func([]byte)) {\n';
      utilities += '\tvar wg sync.WaitGroup\n';
      utilities += '\tworkers := runtime.NumCPU()\n';
      utilities += '\tch := make(chan []byte, len(blocks))\n';
      utilities += '\n';
      utilities += '\t// Start workers\n';
      utilities += '\tfor i := 0; i < workers; i++ {\n';
      utilities += '\t\twg.Add(1)\n';
      utilities += '\t\tgo func() {\n';
      utilities += '\t\t\tdefer wg.Done()\n';
      utilities += '\t\t\tfor block := range ch {\n';
      utilities += '\t\t\t\tprocessor(block)\n';
      utilities += '\t\t\t}\n';
      utilities += '\t\t}()\n';
      utilities += '\t}\n';
      utilities += '\n';
      utilities += '\t// Send blocks to workers\n';
      utilities += '\tfor _, block := range blocks {\n';
      utilities += '\t\tch <- block\n';
      utilities += '\t}\n';
      utilities += '\tclose(ch)\n';
      utilities += '\n';
      utilities += '\t// Wait for completion\n';
      utilities += '\twg.Wait()\n';
      utilities += '}\n\n';
    }

    // XOR utility function
    utilities += '// xorArrays performs XOR operation on two byte slices\n';
    utilities += 'func xorArrays(dst, src []byte) {\n';
    utilities += '\tfor i := range dst {\n';
    utilities += '\t\tif i < len(src) {\n';
    utilities += '\t\t\tdst[i] ^= src[i]\n';
    utilities += '\t\t}\n';
    utilities += '\t}\n';
    utilities += '}\n\n';

    // Constant-time comparison
    this.imports.add('crypto/subtle');
    utilities += '// constantTimeEqual compares two byte slices in constant time\n';
    utilities += 'func constantTimeEqual(a, b []byte) bool {\n';
    utilities += '\treturn subtle.ConstantTimeCompare(a, b) == 1\n';
    utilities += '}\n\n';

    // Context-aware crypto operations
    if (options.useContext) {
      this.imports.add('context');
      this.imports.add('time');
      utilities += '// CryptoOperation represents a context-aware crypto operation\n';
      utilities += 'type CryptoOperation func(ctx context.Context, data []byte) ([]byte, error)\n\n';

      utilities += '// WithTimeout wraps a crypto operation with timeout\n';
      utilities += 'func WithTimeout(op CryptoOperation, timeout time.Duration) CryptoOperation {\n';
      utilities += '\treturn func(ctx context.Context, data []byte) ([]byte, error) {\n';
      utilities += '\t\tctx, cancel := context.WithTimeout(ctx, timeout)\n';
      utilities += '\t\tdefer cancel()\n';
      utilities += '\t\treturn op(ctx, data)\n';
      utilities += '\t}\n';
      utilities += '}\n\n';
    }

    return utilities;
  }

  /**
   * Generate while statement
   * @private
   */
  _generateWhileStatement(node, options) {
    const test = this._generateNode(node.test, options);
    let code = this._indent(`for ${test} {\n`);

    this.indentLevel++;
    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body;
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
    let code = this._indent('for ');

    if (node.init) {
      const init = this._generateNode(node.init, options);
      code += init.replace(/\n/g, '').replace(/^\s+/, '');
    }
    code += '; ';

    if (node.test) {
      const test = this._generateNode(node.test, options);
      code += test;
    }
    code += '; ';

    if (node.update) {
      const update = this._generateNode(node.update, options);
      code += update;
    }

    code += ' {\n';

    this.indentLevel++;
    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body;
    }
    this.indentLevel--;

    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate for-in statement (Go range)
   * @private
   */
  _generateForInStatement(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);

    let code = this._indent(`for _, ${left} := range ${right} {\n`);

    this.indentLevel++;
    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body;
    }
    this.indentLevel--;

    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate for-of statement (Go range)
   * @private
   */
  _generateForOfStatement(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);

    let code = this._indent(`for _, ${left} := range ${right} {\n`);

    this.indentLevel++;
    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body;
    }
    this.indentLevel--;

    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate do-while statement (convert to for loop)
   * @private
   */
  _generateDoWhileStatement(node, options) {
    let code = this._indent('for {\n');

    this.indentLevel++;
    if (node.body) {
      const body = this._generateNode(node.body, options);
      code += body;
    }

    const test = this._generateNode(node.test, options);
    code += this._indent(`if !(${test}) {\n`);
    code += this._indent('\tbreak\n');
    code += this._indent('}\n');
    this.indentLevel--;

    code += this._indent('}\n');
    return code;
  }

  /**
   * Generate switch statement
   * @private
   */
  _generateSwitchStatement(node, options) {
    const discriminant = this._generateNode(node.discriminant, options);
    let code = this._indent(`switch ${discriminant} {\n`);

    if (node.cases) {
      node.cases.forEach(caseNode => {
        code += this._generateNode(caseNode, options);
      });
    }

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
      code += this._indent(`case ${test}:\n`);
    } else {
      code += this._indent('default:\n');
    }

    this.indentLevel++;
    if (node.consequent) {
      node.consequent.forEach(stmt => {
        code += this._generateNode(stmt, options);
      });
    }
    this.indentLevel--;

    return code;
  }

  /**
   * Generate break statement
   * @private
   */
  _generateBreakStatement(node, options) {
    return this._indent('break\n');
  }

  /**
   * Generate continue statement
   * @private
   */
  _generateContinueStatement(node, options) {
    return this._indent('continue\n');
  }

  /**
   * Generate unary expression
   * @private
   */
  _generateUnaryExpression(node, options) {
    const argument = this._generateNode(node.argument, options);

    switch (node.operator) {
      case '!':
        return `!${argument}`;
      case '-':
        return `-${argument}`;
      case '+':
        return `+${argument}`;
      case 'typeof':
        this.imports.add('reflect');
        return `reflect.TypeOf(${argument}).String()`;
      case 'void':
        return `func() interface{} { ${argument}; return nil }()`;
      case '~':
        return `^${argument}`;
      default:
        return `${node.operator}${argument}`;
    }
  }

  /**
   * Generate update expression
   * @private
   */
  _generateUpdateExpression(node, options) {
    const argument = this._generateNode(node.argument, options);

    if (node.prefix) {
      return `${node.operator}${argument}`;
    } else {
      // Go doesn't have postfix as expression, simulate with function
      return `func() interface{} { old := ${argument}; ${argument}${node.operator}; return old }()`;
    }
  }

  /**
   * Generate logical expression
   * @private
   */
  _generateLogicalExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);

    switch (node.operator) {
      case '&&':
        return `${left} && ${right}`;
      case '||':
        return `${left} || ${right}`;
      case '??':
        // Nullish coalescing - Go doesn't have this, simulate
        return `func() interface{} { if val := ${left}; val != nil { return val }; return ${right} }()`;
      default:
        return `${left} ${node.operator} ${right}`;
    }
  }

  /**
   * Generate conditional expression (ternary)
   * @private
   */
  _generateConditionalExpression(node, options) {
    const test = this._generateNode(node.test, options);
    const consequent = this._generateNode(node.consequent, options);
    const alternate = this._generateNode(node.alternate, options);

    return `func() interface{} { if ${test} { return ${consequent} }; return ${alternate} }()`;
  }

  /**
   * Generate function expression
   * @private
   */
  _generateFunctionExpression(node, options) {
    let code = 'func(';

    if (node.params && node.params.length > 0) {
      const params = node.params.map(param => {
        const paramName = param.name || 'param';
        return `${paramName} interface{}`;
      });
      code += params.join(', ');
    }

    code += ') interface{} {\n';

    this.indentLevel++;
    if (node.body) {
      const bodyCode = this._generateNode(node.body, options);
      // Empty body is valid in Go
      code += bodyCode;
    } else {
      // No body - empty is valid
      code += '';
    }
    this.indentLevel--;

    code += this._indent('}');

    return code;
  }

  /**
   * Generate arrow function expression
   * @private
   */
  _generateArrowFunctionExpression(node, options) {
    // Arrow functions are similar to function expressions in Go
    return this._generateFunctionExpression(node, options);
  }

  /**
   * Generate new expression
   * @private
   */
  _generateNewExpression(node, options) {
    // Convert to function call since Go doesn't have 'new'
    return this._generateCallExpression(node, options);
  }

  /**
   * Generate fallback for unsupported nodes
   * @private
   */
  _generateFallbackNode(node, options) {
    return `/* Unsupported AST node type: ${node.type} */`;
  }

  /**
   * Generate empty statement
   * @private
   */
  _generateEmptyStatement(node, options) {
    return '';
  }

  /**
   * Generate sequence expression
   * @private
   */
  _generateSequenceExpression(node, options) {
    if (!node.expressions || node.expressions.length === 0) {
      return '';
    }

    const expressions = node.expressions.map(expr => this._generateNode(expr, options));
    return `func() interface{} { ${expressions.slice(0, -1).join('; ')}; return ${expressions[expressions.length - 1]} }()`;
  }

  /**
   * Generate template literal
   * @private
   */
  _generateTemplateLiteral(node, options) {
    this.imports.add('fmt');

    if (!node.quasis || !node.expressions) {
      return '""';
    }

    let result = 'fmt.Sprintf("';
    let formatStr = '';
    let args = [];

    for (let i = 0; i < node.quasis.length; i++) {
      const quasi = node.quasis[i];
      formatStr += quasi.value ? quasi.value.raw || quasi.value.cooked || '' : '';

      if (i < node.expressions.length) {
        formatStr += '%v';
        args.push(this._generateNode(node.expressions[i], options));
      }
    }

    result += formatStr + '"';
    if (args.length > 0) {
      result += ', ' + args.join(', ');
    }
    result += ')';

    return result;
  }

  /**
   * Handle other missing methods with stubs
   * @private
   */
  _generateTaggedTemplateExpression(node, options) { return this._generateFallbackNode(node, options); }
  _generateRestElement(node, options) { return this._generateFallbackNode(node, options); }
  _generateSpreadElement(node, options) { return this._generateFallbackNode(node, options); }
  _generateAssignmentPattern(node, options) { return this._generateFallbackNode(node, options); }
  _generateObjectPattern(node, options) { return this._generateFallbackNode(node, options); }
  _generateArrayPattern(node, options) { return this._generateFallbackNode(node, options); }
  _generateTryStatement(node, options) { return this._generateFallbackNode(node, options); }
  _generateCatchClause(node, options) { return this._generateFallbackNode(node, options); }
  _generateThrowStatement(node, options) { return this._generateFallbackNode(node, options); }
  _generateDebuggerStatement(node, options) { return this._generateFallbackNode(node, options); }
  _generateWithStatement(node, options) { return this._generateFallbackNode(node, options); }
  _generateLabeledStatement(node, options) { return this._generateFallbackNode(node, options); }
  _generateStructDeclaration(node, options) { return this._generateFallbackNode(node, options); }
  _generateMethodDefinition(node, options) { return this._generateFallbackNode(node, options); }
  _generateMetaProperty(node, options) { return this._generateFallbackNode(node, options); }
  _generateAwaitExpression(node, options) { return this._generateFallbackNode(node, options); }
  _generateYieldExpression(node, options) { return this._generateFallbackNode(node, options); }
  _generateImportDeclaration(node, options) { return this._generateFallbackNode(node, options); }
  _generateExportDeclaration(node, options) { return this._generateFallbackNode(node, options); }
  _generateClassExpression(node, options) { return this._generateFallbackNode(node, options); }
  _generatePropertyDefinition(node, options) { return this._generateFallbackNode(node, options); }
  _generatePrivateIdentifier(node, options) { return this._generateFallbackNode(node, options); }
  _generateStaticBlock(node, options) { return this._generateFallbackNode(node, options); }
  _generateChainExpression(node, options) { return this._generateFallbackNode(node, options); }
  _generateImportExpression(node, options) { return this._generateFallbackNode(node, options); }

  /**
   * Generate generic crypto types (Go 1.18+)
   * @private
   */
  _generateGenericCryptoTypes(options) {
    if (!options.useGenerics) return '';

    let types = '';

    // Generic block cipher
    types += '// GenericBlockCipher represents a generic block cipher\n';
    types += 'type GenericBlockCipher[K any, B any] interface {\n';
    types += '\tNewKey([]byte) (K, error)\n';
    types += '\tNewBlock() B\n';
    types += '\tEncryptBlock(key K, block B) B\n';
    types += '\tDecryptBlock(key K, block B) B\n';
    types += '}\n\n';

    // Generic hash function
    types += '// GenericHash represents a generic hash function\n';
    types += 'type GenericHash[T any] interface {\n';
    types += '\tHash(data []byte) T\n';
    types += '\tSize() int\n';
    types += '}\n\n';

    return types;
  }

  /**
   * Check if Go compiler is available on the system
   * @private
   */
  _isGoAvailable() {
    try {
      const { execSync } = require('child_process');
      execSync('go version', { 
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
   * Basic syntax validation for Go code
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
      
      for (let i = 0; i < code.length; i++) {
        const char = code[i];
        const nextChar = i < code.length - 1 ? code[i + 1] : '';
        
        // Handle raw strings (`...`)
        if (char === '`' && !inString && !inLineComment && !inBlockComment) {
          inRawString = !inRawString;
          continue;
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
   * Validate Go code syntax using go compiler
   * @override
   */
  ValidateCodeSyntax(code) {
    // Check if Go is available first
    if (!this._isGoAvailable()) {
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'Go compiler not available - using basic validation'
      };
    }

    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');
      
      // Create temporary directory and file
      const tempDir = path.join(__dirname, '..', '.agent.tmp', `temp_go_${Date.now()}`);
      const tempFile = path.join(tempDir, 'main.go');
      
      // Ensure temp directory exists
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Create go.mod file for proper module structure
      const goModContent = `module tempvalidation

go 1.21
`;
      fs.writeFileSync(path.join(tempDir, 'go.mod'), goModContent);
      
      // Write Go code to temp file
      fs.writeFileSync(tempFile, code);
      
      try {
        // Try to compile the Go code (build without executing)
        // Use different output depending on platform
        const buildOutput = process.platform === 'win32' ? 'nul' : '/dev/null';
        execSync(`go build -o ${buildOutput} .`, { 
          stdio: 'pipe',
          timeout: 3000,
          cwd: tempDir,
          windowsHide: true  // Prevent Windows error dialogs
        });
        
        // Clean up
        fs.rmSync(tempDir, { recursive: true, force: true });
        
        return {
          success: true,
          method: 'go',
          error: null
        };
        
      } catch (error) {
        // Clean up on error
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
        
        return {
          success: false,
          method: 'go',
          error: error.stderr?.toString() || error.message
        };
      }
      
    } catch (error) {
      // If Go is not available or other error, fall back to basic validation
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'Go compiler not available - using basic validation'
      };
    }
  }

  /**
   * Get Go compiler download information
   * @override
   */
  GetCompilerInfo() {
    return {
      name: this.name,
      compilerName: 'Go',
      downloadUrl: 'https://golang.org/dl/',
      installInstructions: [
        'Download Go from https://golang.org/dl/',
        'Windows: Run the MSI installer and follow the prompts',
        'macOS: Run the PKG installer or use Homebrew: brew install go',
        'Linux: Extract to /usr/local and add /usr/local/go/bin to PATH',
        'Verify installation with: go version',
        'Set GOPATH environment variable (optional for Go 1.11+)'
      ].join('\n'),
      verifyCommand: 'go version',
      alternativeValidation: 'Basic syntax checking (balanced brackets/braces/parentheses)',
      packageManager: 'go mod (built-in module system)',
      documentation: 'https://golang.org/doc/'
    };
  }
}

// Register the plugin
const goPlugin = new GoPlugin();
LanguagePlugins.Add(goPlugin);

// Export for potential direct use
// Export for potential direct use (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = goPlugin;
}


})(); // End of IIFE