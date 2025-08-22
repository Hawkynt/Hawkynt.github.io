#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Check for verbose flag
const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('🧪 JavaScript AST Parser Test Suite');
    console.log('');
    console.log('Usage: node TestJavaScriptAST.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --verbose, -v    Show detailed error context (+/-5 lines) immediately when errors occur');
    console.log('  --help, -h       Show this help message');
    console.log('');
    console.log('This tool tests the TypeAware transpiler against all JavaScript algorithm files');
    console.log('and provides detailed error reporting with source code context.');
    process.exit(0);
}

// Import the TypeAware transpiler
const TypeAwareJSASTTranspiler = require('../type-aware-transpiler.js');

/**
 * Get source code context around a specific line
 */
function getSourceContext(sourceCode, lineNumber, contextLines = 5) {
    const lines = sourceCode.split('\n');
    const startLine = Math.max(0, lineNumber - contextLines - 1);
    const endLine = Math.min(lines.length - 1, lineNumber + contextLines - 1);
    
    const context = [];
    for (let i = startLine; i <= endLine; i++) {
        const marker = i === lineNumber - 1 ? ' >>> ' : '     ';
        context.push(`${marker}${String(i + 1).padStart(4)}: ${lines[i]}`);
    }
    
    return context.join('\n');
}

/**
 * Try to extract line number from error message or parser state
 */
function extractLineNumberFromError(error, parser, sourceCode) {
    // Try to get line number from parser state if available
    if (parser && parser.currentLine) {
        return parser.currentLine;
    }
    
    if (parser && parser.position) {
        // Convert position to line number
        const beforePosition = sourceCode.substring(0, parser.position);
        return beforePosition.split('\n').length;
    }
    
    if (parser && parser.currentToken && parser.currentToken.line) {
        return parser.currentToken.line;
    }
    
    // Try to extract from error message patterns
    const lineMatch = error.message.match(/line (\d+)/i);
    if (lineMatch) {
        return parseInt(lineMatch[1]);
    }
    
    // If no line number, try to find the problematic token in source
    const tokenMatch = error.message.match(/Unexpected token[:\s]*(.+?)(?:\s|$)/i);
    if (tokenMatch) {
        const token = tokenMatch[1].replace(/['"]/g, '').trim();
        const lines = sourceCode.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(token)) {
                return i + 1;
            }
        }
    }
    
    // Try to find error-related keywords in source
    const errorKeywords = ['function', 'export', 'import', 'class', 'const', 'let', 'var'];
    const lines = sourceCode.split('\n');
    
    for (const keyword of errorKeywords) {
        if (error.message.toLowerCase().includes(keyword)) {
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].trim().startsWith(keyword)) {
                    return i + 1;
                }
            }
        }
    }
    
    return null;
}

/**
 * Test runner for JavaScript AST parsing
 */
class TestJavaScriptAST {
    constructor() {
        this.results = {
            totalFiles: 0,
            successfulParsed: 0,
            failedParsed: 0,
            errors: []
        };
        this.algorithmsPath = path.join(__dirname, '..', 'algorithms');
    }

    /**
     * Get all JavaScript files from algorithms directory recursively
     */
    getAllAlgorithmFiles() {
        const jsFiles = [];
        
        const scanDirectory = (dir) => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory()) {
                    scanDirectory(fullPath);
                } else if (entry.isFile() && entry.name.endsWith('.js')) {
                    // Skip backup and migrated files
                    if (!entry.name.includes('.backup') && 
                        !entry.name.includes('.migrated') && 
                        !entry.name.includes('.original') &&
                        !entry.name.includes('_test.js')) {
                        jsFiles.push(fullPath);
                    }
                }
            }
        };
        
        scanDirectory(this.algorithmsPath);
        return jsFiles;
    }

    /**
     * Get context lines around an error position
     */
    getErrorContext(code, errorLine, contextLines = 5) {
        if (!code || !errorLine || errorLine < 1) {
            return 'Unable to determine error location';
        }
        
        const lines = code.split('\n');
        const startLine = Math.max(0, errorLine - contextLines - 1);
        const endLine = Math.min(lines.length - 1, errorLine + contextLines - 1);
        
        const contextCode = [];
        for (let i = startLine; i <= endLine; i++) {
            const lineNum = (i + 1).toString().padStart(4, ' ');
            const marker = (i === errorLine - 1) ? ' >>> ' : '     ';
            const lineContent = lines[i] || '';
            contextCode.push(`${lineNum}${marker}${lineContent}`);
        }
        
        return contextCode.length > 0 ? contextCode.join('\n') : 'Unable to determine error location';
    }

    /**
     * Extract line number from error message
     */
    extractLineNumberFromError(error, code, parser = null) {
        // First try to use parser's current token position if available
        if (parser && parser.currentToken && parser.currentToken.position !== undefined) {
            const lines = code.substring(0, parser.currentToken.position).split('\n');
            return lines.length;
        }
        
        // Try to get line from parser position if available
        if (error.parser && error.parser.position !== undefined) {
            const lines = code.substring(0, error.parser.position).split('\n');
            return lines.length;
        }
        
        // Try to extract from error message patterns
        const lineMatch = error.message.match(/line (\d+)/i);
        if (lineMatch) {
            return parseInt(lineMatch[1]);
        }
        
        // Try to extract from stack trace
        const stackMatch = error.stack.match(/:(\d+):/);
        if (stackMatch) {
            return parseInt(stackMatch[1]);
        }
        
        // If error has a position or current token information, try to use that
        if (error.position !== undefined) {
            const lines = code.substring(0, error.position).split('\n');
            return lines.length;
        }
        
        // For parsing errors, often the error occurs at a specific position
        // Try to find common error patterns and make educated guesses
        const errorPatterns = [
            { pattern: /unexpected token.*?operator\s*\//, searchFor: '/' },
            { pattern: /expected punctuation.*?got.*?identifier/i, searchFor: 'function' },
            { pattern: /unexpected token.*?punctuation\s*\)/i, searchFor: ')' },
            { pattern: /expected.*?got/i, searchFor: 'function' }
        ];
        
        for (const { pattern, searchFor } of errorPatterns) {
            if (pattern.test(error.message)) {
                const lines = code.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].includes(searchFor)) {
                        return i + 1;
                    }
                }
            }
        }
        
        // Last resort: return line 1 if we can't determine anything
        return 1;
    }

    /**
     * Test parsing a single file
     */
    testFile(filePath) {
        console.log(`\n📁 Testing: ${path.relative(this.algorithmsPath, filePath)}`);
        
        let parser = null;
        try {
            // Read file content
            const code = fs.readFileSync(filePath, 'utf8');
            this.results.totalFiles++;
            
            // Create parser instance
            parser = new TypeAwareJSASTTranspiler.TypeAwareJSASTParser(code);
            
            // Test tokenization
            console.log('  🔤 Tokenizing...');
            parser.tokenize();
            console.log(`  ✅ Tokenization successful (${parser.tokens.length} tokens)`);
            
            // Test parsing
            console.log('  🌳 Parsing AST...');
            const ast = parser.parse();
            console.log(`  ✅ AST parsing successful (${ast.body.length} statements)`);
            
            this.results.successfulParsed++;
            return { success: true, ast };
            
        } catch (error) {
            console.log(`  ❌ Parse error: ${error.message}`);
            
            const code = fs.readFileSync(filePath, 'utf8');
            const errorLine = this.extractLineNumberFromError(error, code, parser);
            const context = errorLine ? this.getErrorContext(code, errorLine) : 'Unable to determine error location';
            
            // Show context immediately if verbose mode is enabled
            if ((verbose || global.verbose) && errorLine) {
                console.log('\n  📄 Error Context (+/-5 lines):');
                console.log('  ─'.repeat(40));
                console.log(context.split('\n').map(line => `  ${line}`).join('\n'));
                console.log('  ─'.repeat(40));
            }
            
            const errorInfo = {
                file: path.relative(this.algorithmsPath, filePath),
                error: error.message,
                line: errorLine,
                context: context,
                stack: error.stack
            };
            
            this.results.errors.push(errorInfo);
            this.results.failedParsed++;
            
            return { success: false, error: errorInfo };
        }
    }

    /**
     * Test transpilation to different languages
     */
    testTranspilation(filePath, ast) {
        const languages = ['cs', 'java', 'cpp', 'py', 'ts'];
        const transpilationResults = {};
        
        for (const lang of languages) {
            try {
                console.log(`    🔄 Transpiling to ${lang.toUpperCase()}...`);
                const transpiler = new TypeAwareJSASTTranspiler.TypeAwareJSTranspiler();
                
                const code = fs.readFileSync(filePath, 'utf8');
                const result = transpiler.transpile(code, lang, {
                    stripComments: false,
                    removeDebugCode: true,
                    addTypeAnnotations: true
                });
                
                if (result.success) {
                    console.log(`    ✅ ${lang.toUpperCase()} transpilation successful`);
                    transpilationResults[lang] = { success: true, codeLength: result.code.length };
                } else {
                    console.log(`    ⚠️ ${lang.toUpperCase()} transpilation failed: ${result.error}`);
                    transpilationResults[lang] = { success: false, error: result.error };
                }
            } catch (error) {
                console.log(`    ❌ ${lang.toUpperCase()} transpilation error: ${error.message}`);
                transpilationResults[lang] = { success: false, error: error.message };
            }
        }
        
        return transpilationResults;
    }

    /**
     * Generate detailed error report
     */
    generateErrorReport() {
        console.log('\n' + '='.repeat(80));
        console.log('🔍 DETAILED ERROR REPORT');
        console.log('='.repeat(80));
        
        if (this.results.errors.length === 0) {
            console.log('🎉 No parsing errors found!');
            return;
        }
        
        this.results.errors.forEach((error, index) => {
            console.log(`\n📋 ERROR ${index + 1}/${this.results.errors.length}`);
            console.log(`📁 File: ${error.file}`);
            console.log(`❌ Error: ${error.error}`);
            if (error.line) {
                console.log(`📍 Line: ${error.line}`);
            }
            
            // Always show context in detailed error report, but add extra detail in verbose mode
            console.log('\n📄 Code Context (+/-5 lines):');
            console.log('─'.repeat(40));
            console.log(error.context);
            console.log('─'.repeat(40));
            
            // Show stack trace only in verbose mode
            if ((verbose || global.verbose) && error.stack) {
                console.log('\n🔍 Stack Trace (verbose):');
                console.log('─'.repeat(40));
                console.log(error.stack);
                console.log('─'.repeat(40));
            }
        });
    }

    /**
     * Generate summary statistics
     */
    generateSummary() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 PARSING SUMMARY');
        console.log('='.repeat(80));
        console.log(`📁 Total files tested: ${this.results.totalFiles}`);
        console.log(`✅ Successfully parsed: ${this.results.successfulParsed}`);
        console.log(`❌ Failed to parse: ${this.results.failedParsed}`);
        
        const successRate = this.results.totalFiles > 0 
            ? ((this.results.successfulParsed / this.results.totalFiles) * 100).toFixed(1)
            : 0;
        console.log(`📈 Success rate: ${successRate}%`);
        
        if (this.results.errors.length > 0) {
            console.log('\n🔍 Error breakdown:');
            const errorTypes = {};
            this.results.errors.forEach(error => {
                const errorType = error.error.split(':')[0] || 'Unknown';
                errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
            });
            
            Object.entries(errorTypes)
                .sort(([,a], [,b]) => b - a)
                .forEach(([type, count]) => {
                    console.log(`  • ${type}: ${count} files`);
                });
        }
    }

    /**
     * Save detailed results to JSON file
     */
    saveResults() {
        const resultsFile = path.join(__dirname, 'ast-parsing-results.json');
        const detailedResults = {
            timestamp: new Date().toISOString(),
            summary: {
                totalFiles: this.results.totalFiles,
                successfulParsed: this.results.successfulParsed,
                failedParsed: this.results.failedParsed,
                successRate: this.results.totalFiles > 0 
                    ? ((this.results.successfulParsed / this.results.totalFiles) * 100).toFixed(1)
                    : 0
            },
            errors: this.results.errors
        };
        
        fs.writeFileSync(resultsFile, JSON.stringify(detailedResults, null, 2));
        console.log(`\n💾 Detailed results saved to: ${resultsFile}`);
    }

    /**
     * Run all tests
     */
    async run() {
        console.log('🚀 Starting JavaScript AST Parser Test Suite');
        console.log('Testing TypeAware transpiler against all algorithm files...');
        if (verbose || global.verbose) {
            console.log('🔍 Verbose mode enabled - showing detailed error context immediately');
        }
        console.log('');
        
        const files = this.getAllAlgorithmFiles();
        console.log(`📁 Found ${files.length} algorithm files to test\n`);
        
        // Test each file
        for (const file of files) {
            const result = this.testFile(file);
            
            // If parsing succeeded, test transpilation to other languages
            if (result.success) {
                console.log('  🔄 Testing transpilation...');
                const transpilationResults = this.testTranspilation(file, result.ast);
                
                const successful = Object.values(transpilationResults).filter(r => r.success).length;
                const total = Object.keys(transpilationResults).length;
                console.log(`  📊 Transpilation success: ${successful}/${total} languages`);
            }
        }
        
        // Generate reports
        this.generateErrorReport();
        this.generateSummary();
        this.saveResults();
        
        console.log('\n🏁 Test suite completed!');
        
        // Exit with error code if there were parsing failures
        process.exit(this.results.failedParsed > 0 ? 1 : 0);
    }
}

// Run tests if called directly
if (require.main === module) {
    const testRunner = new TestJavaScriptAST();
    testRunner.run().catch(console.error);
}

module.exports = TestJavaScriptAST;
