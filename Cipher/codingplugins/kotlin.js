/**
 * Kotlin Language Plugin for Multi-Language Code Generation
 * Generates Kotlin compatible code from JavaScript AST
 *
 * Follows the LanguagePlugin specification exactly
 *
 * Uses AST pipeline: JS AST -> Kotlin AST -> Kotlin Emitter
 */

// Import the framework
// Import the framework (Node.js environment)
(function() {
  // Use local variables to avoid global conflicts
  let LanguagePlugin, LanguagePlugins;
  let KotlinAST, KotlinEmitter, KotlinTransformer;

if (typeof require !== 'undefined') {
  // Node.js environment
  const framework = require('./LanguagePlugin.js');
  LanguagePlugin = framework.LanguagePlugin;
  LanguagePlugins = framework.LanguagePlugins;

  // Load AST pipeline components (required)
  KotlinAST = require('./KotlinAST.js');
  const emitterModule = require('./KotlinEmitter.js');
  KotlinEmitter = emitterModule.KotlinEmitter;
  const transformerModule = require('./KotlinTransformer.js');
  KotlinTransformer = transformerModule.KotlinTransformer;
} else {
  // Browser environment - use globals
  LanguagePlugin = window.LanguagePlugin;
  LanguagePlugins = window.LanguagePlugins;
  KotlinAST = window.KotlinAST;
  KotlinEmitter = window.KotlinEmitter;
  KotlinTransformer = window.KotlinTransformer;
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
  }

  /**
   * Generate Kotlin code from Abstract Syntax Tree using AST pipeline
   * @param {Object} ast - Parsed/Modified AST representation
   * @param {Object} options - Generation options
   * @returns {CodeGenerationResult}
   */
  GenerateFromAST(ast, options = {}) {
    try {
      // Merge options
      const mergedOptions = { ...this.options, ...options };

      // Validate AST
      if (!ast || typeof ast !== 'object') {
        return this.CreateErrorResult('Invalid AST: must be an object');
      }

      // Transform JS AST to Kotlin AST
      const transformer = new KotlinTransformer({
        typeKnowledge: mergedOptions.typeKnowledge,
        packageName: mergedOptions.packageName || 'com.cipher.generated'
      });
      const kotlinAst = transformer.transform(ast);

      // Emit Kotlin code from Kotlin AST
      const emitter = new KotlinEmitter({
        indent: mergedOptions.indent || '    ',
        newline: mergedOptions.lineEnding || '\n'
      });
      const code = emitter.emit(kotlinAst);

      // Collect dependencies
      const dependencies = this._collectDependencies(ast, mergedOptions);

      // Generate warnings
      const warnings = this._generateWarnings(ast, mergedOptions);
      warnings.push('Generated using AST pipeline (JS AST -> Kotlin AST -> Emitter)');

      return this.CreateSuccessResult(code, dependencies, warnings);

    } catch (error) {
      return this.CreateErrorResult(`Code generation failed: ${error.message}`);
    }
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

// Register the plugin
const kotlinPlugin = new KotlinPlugin();
LanguagePlugins.Add(kotlinPlugin);

// Export for potential direct use (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = kotlinPlugin;
}

})(); // End of IIFE