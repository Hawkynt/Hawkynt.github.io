/**
 * FreeBasic Language Plugin for Multi-Language Code Generation
 * Generates FreeBasic code from JavaScript AST
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
 * FreeBasic Code Generator Plugin
 * Extends LanguagePlugin base class
 */
class FreeBasicPlugin extends LanguagePlugin {
  constructor() {
    super();
    
    // Required plugin metadata
    this.name = 'FreeBasic';
    this.extension = 'bas';
    this.icon = '🆓';
    this.description = 'FreeBasic language code generator';
    this.mimeType = 'text/x-freebasic';
    this.version = 'FreeBasic 1.09+';
    
    // FreeBasic-specific options
    this.options = {
      indent: '    ', // 4 spaces
      lineEnding: '\n',
      addComments: true,
      useStrictTypes: true,
      explicitKeywords: true // Use explicit keywords like DIM, AS, etc.
    };
    
    // Internal state
    this.indentLevel = 0;
    this.includes = new Set();
    this.declaredFunctions = new Map();
    this.requiresCrypto = false;
    this.projectFiles = new Map();
  }

  /**
   * Generate FreeBasic code from Abstract Syntax Tree
   * @param {Object} ast - Parsed/Modified AST representation
   * @param {Object} options - Generation options
   * @returns {CodeGenerationResult}
   */
  GenerateFromAST(ast, options = {}) {
    try {
      // Reset state for clean generation
      this.indentLevel = 0;
      this.includes.clear();
      this.declaredFunctions.clear();
      this.requiresCrypto = false;
      this.projectFiles.clear();
      
      // Merge options
      const mergedOptions = { ...this.options, ...options };
      
      // Validate AST
      if (!ast || typeof ast !== 'object') {
        return this.CreateErrorResult('Invalid AST: must be an object');
      }
      
      // Generate FreeBasic code
      const code = this._generateNode(ast, mergedOptions);
      
      // Add includes and program structure
      const finalCode = this._wrapWithProgramStructure(code, mergedOptions);
      
      // Collect dependencies
      const dependencies = this._collectDependencies(ast, mergedOptions);

      // Generate warnings if any
      const warnings = this._generateWarnings(ast, mergedOptions);

      // Create result with project files
      const result = this.CreateSuccessResult(finalCode, dependencies, warnings);
      result.projectFiles = this.projectFiles;

      return result;
      
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
        return this._generateFunction(node, options);
      case 'ClassDeclaration':
        return this._generateType(node, options);
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
      default:
        return "' TODO: Implement " + node.type;
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
    const functionName = node.id ? this._toPascalCase(node.id.name) : 'UnnamedFunction';

    // Track declared functions for main program usage
    this.declaredFunctions.set(functionName, {
      name: functionName,
      params: node.params || [],
      returnType: 'Integer'
    });

    // Check for crypto operations
    if (this._isCryptoFunction(functionName)) {
      this.requiresCrypto = true;
      this.includes.add('crt');
    }

    let code = '';
    
    // FreeBasic comment
    if (options.addComments) {
      code += this._indent("' " + functionName + " function\n");
      code += this._indent("' Performs the " + (node.id ? node.id.name : 'unnamed') + " operation\n");
      if (node.params && node.params.length > 0) {
        node.params.forEach(param => {
          const paramName = param.name || 'param';
          code += this._indent("' @param " + paramName + " As Integer - input parameter\n");
        });
      }
      code += this._indent("' @return As Integer - result of the operation\n");
    }
    
    // Function signature
    code += this._indent('Function ' + functionName + '(');
    
    // Parameters with FreeBasic types
    if (node.params && node.params.length > 0) {
      const params = node.params.map(param => {
        const paramName = param.name || 'param';
        return 'ByVal ' + this._toPascalCase(paramName) + ' As Integer';
      });
      code += params.join(', ');
    }
    
    code += ') As Integer\n';
    
    // Function body
    this.indentLevel++;
    if (node.body) {
      const bodyCode = this._generateNode(node.body, options);
      code += bodyCode || this._indent('Error "Not implemented"\n');
    } else {
      code += this._indent('Error "Not implemented"\n');
    }
    this.indentLevel--;
    
    code += this._indent('End Function\n');
    
    return code;
  }

  /**
   * Generate type (equivalent to class/struct)
   * @private
   */
  _generateType(node, options) {
    const typeName = node.id ? this._toPascalCase(node.id.name) : 'UnnamedType';
    let code = '';
    
    // Type comment
    if (options.addComments) {
      code += this._indent("' " + typeName + " type\n");
      code += this._indent("' Represents a " + (node.id ? node.id.name : 'unnamed') + " entity\n");
    }
    
    // Type declaration
    code += this._indent('Type ' + typeName + '\n');
    
    // Type fields
    this.indentLevel++;
    code += this._indent("' Add fields here\n");
    code += this._indent('Value As Integer\n');
    this.indentLevel--;
    
    code += this._indent('End Type\n\n');
    
    // Methods as separate functions (FreeBasic doesn't have true OOP methods in types)
    if (node.body && node.body.length > 0) {
      code += this._indent("' Methods for " + typeName + "\n");
      const methods = node.body
        .map(method => this._generateMethodAsFunction(method, typeName, options))
        .filter(m => m.trim());
      code += methods.join('\n\n');
    }
    
    return code;
  }

  /**
   * Generate method as a standalone function
   * @private
   */
  _generateMethodAsFunction(node, typeName, options) {
    if (!node.key || !node.value) return '';
    
    const methodName = this._toPascalCase(node.key.name);
    const isConstructor = node.key.name === 'constructor';
    let code = '';
    
    // Method comment
    if (options.addComments) {
      code += this._indent("' " + (isConstructor ? typeName + ' Constructor' : methodName + ' method for ' + typeName) + "\n");
    }
    
    // Function signature
    if (isConstructor) {
      code += this._indent('Function Create' + typeName + '(');
    } else {
      code += this._indent('Function ' + typeName + '_' + methodName + '(');
      // Add self parameter
      code += 'ByRef Self As ' + typeName;
      if (node.value.params && node.value.params.length > 0) {
        code += ', ';
      }
    }
    
    // Parameters
    if (node.value.params && node.value.params.length > 0) {
      const params = node.value.params.map(param => {
        const paramName = param.name || 'param';
        return 'ByVal ' + this._toPascalCase(paramName) + ' As Integer';
      });
      code += params.join(', ');
    }
    
    if (isConstructor) {
      code += ') As ' + typeName + '\n';
    } else {
      code += ') As Integer\n';
    }
    
    // Function body
    this.indentLevel++;
    if (node.value.body) {
      const bodyCode = this._generateNode(node.value.body, options);
      code += bodyCode || (isConstructor ? this._indent('Dim Result As ' + typeName + '\n' + 'Return Result\n') : this._indent('Error "Not implemented"\n'));
    } else {
      if (isConstructor) {
        code += this._indent('Dim Result As ' + typeName + '\n');
        code += this._indent('Return Result\n');
      } else {
        code += this._indent('Error "Not implemented"\n');
      }
    }
    this.indentLevel--;
    
    code += this._indent('End Function\n');
    
    return code;
  }

  /**
   * Generate method definition (placeholder)
   * @private
   */
  _generateMethod(node, options) {
    // In FreeBasic, methods are handled as functions
    return this._generateMethodAsFunction(node, 'UnknownType', options);
  }

  /**
   * Generate block statement
   * @private
   */
  _generateBlock(node, options) {
    if (!node.body || node.body.length === 0) {
      return this._indent('Error "Empty block"\n');
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
        const varName = decl.id ? this._toPascalCase(decl.id.name) : 'Variable';
        
        if (decl.init) {
          const initValue = this._generateNode(decl.init, options);
          // FreeBasic variable declaration with initialization
          return this._indent('Dim ' + varName + ' As Integer = ' + initValue + '\n');
        } else {
          return this._indent('Dim ' + varName + ' As Integer\n');
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
      return this._indent('Return ' + returnValue + '\n');
    } else {
      return this._indent('Return 0\n'); // FreeBasic functions need return value
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
    
    // FreeBasic operators
    switch (operator) {
      case '===':
      case '==':
        operator = '=';
        break;
      case '!==':
      case '!=':
        operator = '<>';
        break;
      case '&&':
        operator = 'And';
        break;
      case '||':
        operator = 'Or';
        break;
      case '%':
        operator = 'Mod';
        break;
    }
    
    return left + ' ' + operator + ' ' + right;
  }

  /**
   * Generate call expression
   * @private
   */
  _generateCallExpression(node, options) {
    const callee = this._generateNode(node.callee, options);
    const args = node.arguments ? 
      node.arguments.map(arg => this._generateNode(arg, options)).join(', ') : '';
    
    return callee + '(' + args + ')';
  }

  /**
   * Generate member expression
   * @private
   */
  _generateMemberExpression(node, options) {
    const object = this._generateNode(node.object, options);
    const property = node.computed ? 
      '(' + this._generateNode(node.property, options) + ')' : 
      '.' + this._toPascalCase(node.property.name || node.property);
    
    return object + property;
  }

  /**
   * Generate assignment expression
   * @private
   */
  _generateAssignmentExpression(node, options) {
    const left = this._generateNode(node.left, options);
    const right = this._generateNode(node.right, options);
    
    // FreeBasic uses = for assignment
    return left + ' = ' + right;
  }

  /**
   * Generate identifier
   * @private
   */
  _generateIdentifier(node, options) {
    return this._toPascalCase(node.name);
  }

  /**
   * Generate literal
   * @private
   */
  _generateLiteral(node, options) {
    if (typeof node.value === 'string') {
      return '"' + node.value.replace(/"/g, '""') + '"';
    } else if (node.value === null) {
      return '0'; // FreeBasic doesn't have null, use 0 or empty string
    } else if (typeof node.value === 'boolean') {
      return node.value ? '-1' : '0'; // FreeBasic uses -1 for true, 0 for false
    } else {
      return String(node.value);
    }
  }

  /**
   * Convert to PascalCase (FreeBasic convention)
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
   * Wrap generated code with program structure
   * @private
   */
  _wrapWithProgramStructure(code, options) {
    let result = '';
    
    // File header comment
    if (options.addComments) {
      result += "' Generated FreeBasic code\n";
      result += "' This file was automatically generated from JavaScript AST\n";
      result += "' Compiler: " + this.version + "\n";
      result += "' Date: " + new Date().toDateString() + "\n\n";
    }
    
    // FreeBasic directives
    result += '#Lang "fb"\n'; // Use FreeBasic syntax
    result += 'Option Explicit\n'; // Require variable declarations
    result += 'Option Escape\n\n'; // Enable escape sequences
    
    // Standard includes
    if (this.requiresCrypto) {
      result += '\' Crypto operation includes\n';
      result += '#Include "crt.bi"\n';
      result += '\n';
    }

    // Custom includes
    if (this.includes.size > 0) {
      result += '\' Additional includes\n';
      for (const inc of this.includes) {
        result += '#Include "' + inc + '.bi"\n';
      }
      result += '\n';
    }

    // OpCodes-style crypto functions if needed
    if (this.requiresCrypto) {
      result += this._generateOpCodesFunctions(options);
    }
    
    // Generated code
    result += code;
    
    // Main program entry point with example usage
    result += this._generateMainProgram(options);

    // Generate project files
    this._generateProjectFiles(options);
    
    return result;
  }

  /**
   * Generate main program with example usage
   * @private
   */
  _generateMainProgram(options) {
    let result = '\n\n\' Main program\n';
    result += 'Sub Main()\n';
    result += '    \' Example usage of generated functions\n';
    result += '    Print "Generated FreeBASIC Code - Test Run"\n';
    result += '    Print "=" + String(40, "=")\n';
    result += '    Print\n';

    // Generate example calls for declared functions
    if (this.declaredFunctions.size > 0) {
      result += '    \' Testing generated functions\n';

      for (const [funcName, funcInfo] of this.declaredFunctions) {
        result += '    Print "Testing function: ' + funcName + '"\n';

        // Generate example call with sample parameters
        let exampleCall = '    Dim result' + funcName + ' As Integer = ' + funcName + '(';

        if (funcInfo.params.length > 0) {
          const sampleParams = funcInfo.params.map((param, index) => {
            const paramName = param.name || `param${index}`;
            if (paramName.toLowerCase().includes('key') || paramName.toLowerCase().includes('data')) {
              return '42'; // Sample crypto data
            }
            return (index + 1) * 10; // Sample numeric values
          });
          exampleCall += sampleParams.join(', ');
        }

        exampleCall += ')\n';
        result += exampleCall;
        result += '    Print "Result: " + Str(result' + funcName + ')\n';
        result += '    Print\n';
      }
    } else {
      result += '    Print "No functions to test"\n';
    }

    result += '    Print "Test completed successfully!"\n';
    result += '    Print "Press any key to exit..."\n';
    result += '    Sleep\n'; // Wait for keypress
    result += 'End Sub\n\n';
    result += 'Main()\n'; // Call main subroutine

    return result;
  }

  /**
   * Generate project files for FreeBASIC
   * @private
   */
  _generateProjectFiles(options) {
    // Generate Makefile
    this.projectFiles.set('Makefile', this._generateMakefile(options));

    // Generate batch file for Windows
    this.projectFiles.set('build.bat', this._generateBuildBatch(options));

    // Generate shell script for Unix
    this.projectFiles.set('build.sh', this._generateBuildShell(options));

    // Generate README.md with instructions
    this.projectFiles.set('README.md', this._generateReadme(options));
  }

  /**
   * Generate Makefile for FreeBASIC project
   * @private
   */
  _generateMakefile(options) {
    let makefile = '# Generated Makefile for FreeBASIC project\n';
    makefile += '# Generated on: ' + new Date().toDateString() + '\n';
    makefile += '\n';
    makefile += 'CC = fbc\n';
    makefile += 'CFLAGS = -lang fb -w all\n';
    makefile += 'TARGET = program\n';
    makefile += 'SOURCE = *.bas\n';
    makefile += '\n';
    makefile += 'all: $(TARGET)\n';
    makefile += '\n';
    makefile += '$(TARGET): $(SOURCE)\n';
    makefile += '\t$(CC) $(CFLAGS) -x $(TARGET) $(SOURCE)\n';
    makefile += '\n';
    makefile += 'debug: $(SOURCE)\n';
    makefile += '\t$(CC) $(CFLAGS) -g -x $(TARGET)_debug $(SOURCE)\n';
    makefile += '\n';
    makefile += 'clean:\n';
    if (process.platform === 'win32') {
      makefile += '\tdel /Q $(TARGET).exe $(TARGET)_debug.exe 2>NUL || true\n';
    } else {
      makefile += '\trm -f $(TARGET) $(TARGET)_debug\n';
    }
    makefile += '\n';
    makefile += 'run: $(TARGET)\n';
    if (process.platform === 'win32') {
      makefile += '\t.\\$(TARGET).exe\n';
    } else {
      makefile += '\t./$(TARGET)\n';
    }
    makefile += '\n';
    makefile += '.PHONY: all debug clean run\n';

    return makefile;
  }

  /**
   * Generate Windows batch file
   * @private
   */
  _generateBuildBatch(options) {
    let batch = '@echo off\n';
    batch += 'REM Generated build script for FreeBASIC\n';
    batch += 'REM Generated on: ' + new Date().toDateString() + '\n';
    batch += '\n';
    batch += 'echo Building FreeBASIC project...\n';
    batch += '\n';
    batch += 'REM Check if FreeBASIC compiler is available\n';
    batch += 'fbc -version >nul 2>&1\n';
    batch += 'if errorlevel 1 (\n';
    batch += '    echo Error: FreeBASIC compiler (fbc) not found!\n';
    batch += '    echo Please install FreeBASIC from https://www.freebasic.net/\n';
    batch += '    echo and add it to your PATH\n';
    batch += '    pause\n';
    batch += '    exit /b 1\n';
    batch += ')\n';
    batch += '\n';
    batch += 'REM Compile the program\n';
    batch += 'fbc -lang fb -w all -x program *.bas\n';
    batch += 'if errorlevel 1 (\n';
    batch += '    echo Compilation failed!\n';
    batch += '    pause\n';
    batch += '    exit /b 1\n';
    batch += ')\n';
    batch += '\n';
    batch += 'echo Compilation successful!\n';
    batch += 'echo Running program...\n';
    batch += 'echo.\n';
    batch += 'program.exe\n';
    batch += 'echo.\n';
    batch += 'echo Program finished.\n';
    batch += 'pause\n';

    return batch;
  }

  /**
   * Generate Unix shell script
   * @private
   */
  _generateBuildShell(options) {
    let shell = '#!/bin/bash\n';
    shell += '# Generated build script for FreeBASIC\n';
    shell += '# Generated on: ' + new Date().toDateString() + '\n';
    shell += '\n';
    shell += 'echo "Building FreeBASIC project..."\n';
    shell += '\n';
    shell += '# Check if FreeBASIC compiler is available\n';
    shell += 'if ! command -v fbc &> /dev/null; then\n';
    shell += '    echo "Error: FreeBASIC compiler (fbc) not found!"\n';
    shell += '    echo "Please install FreeBASIC:"\n';
    shell += '    echo "  Ubuntu/Debian: sudo apt install fbc"\n';
    shell += '    echo "  macOS: brew install freebasic"\n';
    shell += '    echo "  Arch Linux: sudo pacman -S freebasic"\n';
    shell += '    echo "  Or download from https://www.freebasic.net/"\n';
    shell += '    exit 1\n';
    shell += 'fi\n';
    shell += '\n';
    shell += '# Compile the program\n';
    shell += 'fbc -lang fb -w all -x program *.bas\n';
    shell += 'if [ $? -ne 0 ]; then\n';
    shell += '    echo "Compilation failed!"\n';
    shell += '    exit 1\n';
    shell += 'fi\n';
    shell += '\n';
    shell += 'echo "Compilation successful!"\n';
    shell += 'echo "Running program..."\n';
    shell += 'echo\n';
    shell += './program\n';
    shell += 'echo\n';
    shell += 'echo "Program finished."\n';

    return shell;
  }

  /**
   * Generate README.md with compilation instructions
   * @private
   */
  _generateReadme(options) {
    let readme = '# Generated FreeBASIC Project\n';
    readme += '\n';
    readme += 'This FreeBASIC project was automatically generated from JavaScript AST.\n';
    readme += '\n';
    readme += '## Generated Files\n';
    readme += '\n';
    readme += '- `*.bas` - FreeBASIC source files\n';
    readme += '- `Makefile` - Build configuration for make\n';
    readme += '- `build.bat` - Windows build script\n';
    readme += '- `build.sh` - Unix/Linux build script\n';
    readme += '- `README.md` - This file\n';
    readme += '\n';
    readme += '## Requirements\n';
    readme += '\n';
    readme += '- FreeBASIC Compiler 1.09.0 or later\n';
    readme += '- Download from: https://www.freebasic.net/wiki/CompilerInstalling\n';
    readme += '\n';
    readme += '### Installation Instructions\n';
    readme += '\n';
    readme += '**Windows:**\n';
    readme += '1. Download FreeBASIC from https://www.freebasic.net/wiki/CompilerInstalling\n';
    readme += '2. Extract the archive to a folder (e.g., `C:\\FreeBASIC`)\n';
    readme += '3. Add the FreeBASIC folder to your PATH environment variable\n';
    readme += '4. Verify installation: `fbc -version`\n';
    readme += '\n';
    readme += '**Ubuntu/Debian:**\n';
    readme += '```bash\n';
    readme += 'sudo apt update\n';
    readme += 'sudo apt install fbc\n';
    readme += '```\n';
    readme += '\n';
    readme += '**macOS (with Homebrew):**\n';
    readme += '```bash\n';
    readme += 'brew install freebasic\n';
    readme += '```\n';
    readme += '\n';
    readme += '**Arch Linux:**\n';
    readme += '```bash\n';
    readme += 'sudo pacman -S freebasic\n';
    readme += '```\n';
    readme += '\n';
    readme += '## Building and Running\n';
    readme += '\n';
    readme += '### Method 1: Using Make (cross-platform)\n';
    readme += '\n';
    readme += '```bash\n';
    readme += '# Build the program\n';
    readme += 'make\n';
    readme += '\n';
    readme += '# Run the program\n';
    readme += 'make run\n';
    readme += '\n';
    readme += '# Build debug version\n';
    readme += 'make debug\n';
    readme += '\n';
    readme += '# Clean build artifacts\n';
    readme += 'make clean\n';
    readme += '```\n';
    readme += '\n';
    readme += '### Method 2: Using Build Scripts\n';
    readme += '\n';
    readme += '**Windows:**\n';
    readme += '```cmd\n';
    readme += 'build.bat\n';
    readme += '```\n';
    readme += '\n';
    readme += '**Unix/Linux/macOS:**\n';
    readme += '```bash\n';
    readme += 'chmod +x build.sh\n';
    readme += './build.sh\n';
    readme += '```\n';
    readme += '\n';
    readme += '### Method 3: Manual Compilation\n';
    readme += '\n';
    readme += '```bash\n';
    readme += '# Basic compilation\n';
    readme += 'fbc -lang fb *.bas\n';
    readme += '\n';
    readme += '# With all warnings enabled\n';
    readme += 'fbc -lang fb -w all *.bas\n';
    readme += '\n';
    readme += '# Optimized release build\n';
    readme += 'fbc -lang fb -O 2 -x program *.bas\n';
    readme += '\n';
    readme += '# Debug build\n';
    readme += 'fbc -lang fb -g -x program_debug *.bas\n';
    readme += '```\n';
    readme += '\n';
    readme += '## Project Structure\n';
    readme += '\n';
    readme += 'The generated code follows FreeBASIC conventions:\n';
    readme += '\n';
    readme += '- Functions use PascalCase naming\n';
    readme += '- Explicit type declarations with `As` keyword\n';
    readme += '- Proper variable scoping with `Dim`\n';
    readme += '- Modern FreeBASIC syntax (`#Lang "fb"`)\n';
    readme += '- Error checking and validation\n';

    if (this.requiresCrypto) {
      readme += '\n';
      readme += '## Cryptographic Operations\n';
      readme += '\n';
      readme += 'This project contains cryptographic functions. Please note:\n';
      readme += '\n';
      readme += '- The generated code is for educational/testing purposes\n';
      readme += '- For production use, consider established crypto libraries\n';
      readme += '- Always validate cryptographic implementations thoroughly\n';
      readme += '- Follow security best practices for key management\n';
    }

    readme += '\n';
    readme += '## Troubleshooting\n';
    readme += '\n';
    readme += '**Compiler not found:**\n';
    readme += '- Ensure FreeBASIC is properly installed\n';
    readme += '- Check that `fbc` is in your system PATH\n';
    readme += '- Try running `fbc -version` to verify installation\n';
    readme += '\n';
    readme += '**Compilation errors:**\n';
    readme += '- Check FreeBASIC version compatibility\n';
    readme += '- Ensure all required files are present\n';
    readme += '- Review compiler error messages for specific issues\n';
    readme += '\n';
    readme += '**Runtime errors:**\n';
    readme += '- Build with debug flags: `fbc -lang fb -g *.bas`\n';
    readme += '- Use FreeBASIC debugger or add print statements\n';
    readme += '- Check for uninitialized variables or array bounds\n';
    readme += '\n';
    readme += '## Additional Resources\n';
    readme += '\n';
    readme += '- [FreeBASIC Documentation](https://www.freebasic.net/wiki/DocToc)\n';
    readme += '- [FreeBASIC Language Reference](https://www.freebasic.net/wiki/CatPgLangProc)\n';
    readme += '- [FreeBASIC Examples](https://www.freebasic.net/wiki/CatPgExamples)\n';
    readme += '- [FreeBASIC Community Forum](https://www.freebasic.net/forum/)\n';
    readme += '\n';
    readme += '---\n';
    readme += '*Generated on: ' + new Date().toDateString() + '*\n';

    return readme;
  }

  /**
   * Generate OpCodes-style cryptographic functions for FreeBASIC
   * @private
   */
  _generateOpCodesFunctions(options) {
    let code = '';

    if (options.addComments) {
      code += '\' OpCodes-style cryptographic functions for FreeBASIC\n';
      code += '\' These functions provide basic crypto operations\n';
      code += '\n';
    }

    // Basic bit rotation functions
    code += 'Function RotL32(ByVal value As ULong, ByVal positions As Integer) As ULong\n';
    code += '    \' 32-bit left rotation\n';
    code += '    Return (value Shl positions) Or (value Shr (32 - positions))\n';
    code += 'End Function\n';
    code += '\n';

    code += 'Function RotR32(ByVal value As ULong, ByVal positions As Integer) As ULong\n';
    code += '    \' 32-bit right rotation\n';
    code += '    Return (value Shr positions) Or (value Shl (32 - positions))\n';
    code += 'End Function\n';
    code += '\n';

    // Byte array XOR function
    code += 'Sub XorArrays(ByRef arr1() As UByte, ByRef arr2() As UByte, ByRef result() As UByte)\n';
    code += '    \' XOR two byte arrays\n';
    code += '    Dim As Integer maxLen = IIf(UBound(arr1) > UBound(arr2), UBound(arr1), UBound(arr2))\n';
    code += '    ReDim result(maxLen)\n';
    code += '    For i As Integer = 0 To maxLen\n';
    code += '        Dim As UByte val1 = IIf(i <= UBound(arr1), arr1(i), 0)\n';
    code += '        Dim As UByte val2 = IIf(i <= UBound(arr2), arr2(i), 0)\n';
    code += '        result(i) = val1 Xor val2\n';
    code += '    Next\n';
    code += 'End Sub\n';
    code += '\n';

    // Hex conversion functions
    code += 'Function BytesToHex(ByRef bytes() As UByte) As String\n';
    code += '    \' Convert byte array to hex string\n';
    code += '    Dim As String result = ""\n';
    code += '    For i As Integer = 0 To UBound(bytes)\n';
    code += '        result += Right("0" + Hex(bytes(i)), 2)\n';
    code += '    Next\n';
    code += '    Return result\n';
    code += 'End Function\n';
    code += '\n';

    code += 'Sub HexToBytes(ByVal hexStr As String, ByRef bytes() As UByte)\n';
    code += '    \' Convert hex string to byte array\n';
    code += '    Dim As Integer length = Len(hexStr) \\ 2\n';
    code += '    ReDim bytes(length - 1)\n';
    code += '    For i As Integer = 0 To length - 1\n';
    code += '        Dim As String hexByte = Mid(hexStr, i * 2 + 1, 2)\n';
    code += '        bytes(i) = Val("&H" + hexByte)\n';
    code += '    Next\n';
    code += 'End Sub\n';
    code += '\n';

    // Simple hash function (educational purposes)
    code += 'Function SimpleHash(ByVal input As String) As ULong\n';
    code += '    \' Simple hash function for demonstration\n';
    code += '    Dim As ULong hash = 5381\n';
    code += '    For i As Integer = 1 To Len(input)\n';
    code += '        hash = ((hash Shl 5) + hash) + Asc(Mid(input, i, 1))\n';
    code += '    Next\n';
    code += '    Return hash\n';
    code += 'End Function\n';
    code += '\n';

    return code;
  }

  /**
   * Check if function name suggests cryptographic operation
   * @private
   */
  _isCryptoFunction(name) {
    const cryptoKeywords = ['encrypt', 'decrypt', 'hash', 'cipher', 'crypto', 'aes', 'des', 'rsa', 'sha', 'md5'];
    const lowerName = name.toLowerCase();
    return cryptoKeywords.some(keyword => lowerName.includes(keyword));
  }

  /**
   * Collect required dependencies
   * @private
   */
  _collectDependencies(ast, options) {
    const dependencies = [];

    // FreeBASIC compiler dependency
    dependencies.push({
      name: 'FreeBASIC Compiler',
      version: '1.09.0+',
      type: 'compiler',
      url: 'https://www.freebasic.net/wiki/CompilerInstalling'
    });

    // Platform-specific dependencies
    if (process.platform === 'win32') {
      dependencies.push({
        name: 'Windows C Runtime',
        version: 'System',
        type: 'runtime'
      });
    }

    // Crypto dependencies if needed
    if (this.requiresCrypto) {
      dependencies.push({
        name: 'FreeBASIC CRT Library',
        version: 'Included',
        type: 'library'
      });
    }

    return dependencies;
  }

  /**
   * Generate project files as separate files
   * @returns {Object} Map of filename to content
   */
  GenerateProjectFiles() {
    return this.projectFiles;
  }

  /**
   * Generate warnings about potential issues
   * @private
   */
  _generateWarnings(ast, options) {
    const warnings = [];
    
    // FreeBasic-specific warnings
    warnings.push('Consider using specific numeric types (Single, Double, LongInt) instead of Integer');
    warnings.push('Add proper error handling with On Error or explicit checks');
    warnings.push('Use Option Explicit to require variable declarations');
    warnings.push('Consider using UDTs (User Defined Types) for better data organization');
    
    return warnings;
  }

  /**
   * Check if FreeBASIC compiler is available on the system
   * @private
   */
  _isFBCAvailable() {
    try {
      const { execSync } = require('child_process');
      execSync('fbc -version', { 
        stdio: 'pipe', 
        timeout: 1000,
        windowsHide: true  // Prevent Windows error dialogs
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate FreeBasic code syntax using FreeBASIC compiler
   * @override
   */
  ValidateCodeSyntax(code) {
    // Check if FBC is available first
    const fbcAvailable = this._isFBCAvailable();
    if (!fbcAvailable) {
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'FreeBASIC compiler (fbc) not available - using basic validation'
      };
    }

    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');
      
      // Create temporary file
      const tempFile = path.join(__dirname, '..', '.agent.tmp', `temp_freebasic_${Date.now()}.bas`);
      
      // Ensure .agent.tmp directory exists
      const tempDir = path.dirname(tempFile);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Write code to temp file
      fs.writeFileSync(tempFile, code);
      
      try {
        // Check FreeBasic syntax using FBC -c (compile only, no linking) flag
        execSync(`fbc -c "${tempFile}"`, { 
          stdio: 'pipe',
          timeout: 3000,
          windowsHide: true  // Prevent Windows error dialogs
        });
        
        // Clean up (FBC might create additional files)
        const baseName = path.parse(tempFile).name;
        const baseDir = path.dirname(tempFile);
        
        // Remove original temp file
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
        
        // Clean up potential compiler outputs
        const possibleOutputs = [
          path.join(baseDir, baseName + '.o'),
          path.join(baseDir, baseName),
          path.join(baseDir, baseName + '.exe')
        ];
        
        possibleOutputs.forEach(file => {
          try {
            if (fs.existsSync(file)) {
              fs.unlinkSync(file);
            }
          } catch (e) {
            // Ignore cleanup errors
          }
        });
        
        return {
          success: true,
          method: 'fbc',
          error: null
        };
        
      } catch (error) {
        // Clean up on error
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
        
        return {
          success: false,
          method: 'fbc',
          error: error.stderr?.toString() || error.message
        };
      }
      
    } catch (error) {
      // If FBC is not available or other error, fall back to basic validation
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'FreeBASIC compiler not available - using basic validation'
      };
    }
  }

  /**
   * Get FreeBASIC compiler download information
   * @override
   */
  GetCompilerInfo() {
    return {
      name: this.name,
      compilerName: 'FreeBASIC Compiler (FBC)',
      downloadUrl: 'https://www.freebasic.net/wiki/CompilerInstalling',
      installInstructions: [
        'Download FreeBASIC from https://www.freebasic.net/wiki/CompilerInstalling',
        'For Windows: Download and extract the ZIP file, add to PATH',
        'For Ubuntu/Debian: sudo apt install fbc',
        'For macOS: Use Homebrew - brew install freebasic',
        'For Arch Linux: sudo pacman -S freebasic',
        'For source compilation: https://github.com/freebasic/fbc',
        'Add FBC to your system PATH',
        'Verify installation with: fbc -version',
        'Note: Modern BASIC with advanced features and good C library integration'
      ].join('\n'),
      verifyCommand: 'fbc -version',
      alternativeValidation: 'Basic syntax checking (balanced brackets/parentheses)',
      packageManager: 'None (standalone compiler)',
      documentation: 'https://www.freebasic.net/wiki/DocToc'
    };
  }
}

// Register the plugin
const freebasicPlugin = new FreeBasicPlugin();
LanguagePlugins.Add(freebasicPlugin);

// Export for potential direct use
// Export for potential direct use (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = freebasicPlugin;
}


})(); // End of IIFE