#!/usr/bin/env node
/**
 * CLI Transpiler Script
 * Transpiles JavaScript files to target languages using language plugins
 */

const fs = require('fs');
const path = require('path');

// Load type-aware transpiler
const { TypeAwareJSTranspiler } = require('./type-aware-transpiler.js');

// Load language plugin framework
const { LanguagePlugin, LanguagePlugins } = require('./codingplugins/LanguagePlugin.js');

// Load C# plugin
const csharpPlugin = require('./codingplugins/csharp.js');

// Get command line arguments
const args = process.argv.slice(2);

if (args.length < 1) {
  console.error('Usage: node transpile.js <input.js> [language]');
  console.error('Example: node transpile.js OpCodes.js csharp');
  process.exit(1);
}

const inputFile = args[0];
const targetLanguage = args[1] || 'C#'; // Default to C#

// Read input file
if (!fs.existsSync(inputFile)) {
  console.error(`Error: File not found: ${inputFile}`);
  process.exit(1);
}

const sourceCode = fs.readFileSync(inputFile, 'utf8');

// Generate class name from input file (e.g., "rijndael.js" -> "RijndaelGenerated")
const baseName = path.basename(inputFile, path.extname(inputFile));
const className = baseName.charAt(0).toUpperCase() + baseName.slice(1) + 'Generated';

// Get the language plugin
const plugin = LanguagePlugins.GetByName(targetLanguage);
if (!plugin) {
  console.error(`Error: Language plugin '${targetLanguage}' not found`);
  console.error('Available plugins:', LanguagePlugins.GetAll().map(p => p.name).join(', '));
  process.exit(1);
}

// Transpile using TypeAwareTranspiler
try {
  const transpiler = new TypeAwareJSTranspiler();
  const result = transpiler.transpile(sourceCode, plugin, {
    useAstPipeline: true,  // Use AST pipeline for better type handling
    className: className   // Use unique class name from source file
  });

  if (!result.success) {
    console.error(`Error during transpilation: ${result.error}`);
    process.exit(1);
  }

  // Output the generated code
  console.log(result.code);

} catch (error) {
  console.error(`Error during transpilation: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
}
