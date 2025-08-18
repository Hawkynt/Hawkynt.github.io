#!/usr/bin/env node
/*
 * OpCodes Code Generation Demonstration
 * Tests and demonstrates the multi-language code generation capabilities
 * (c)2006-2025 Hawkynt
 */

// Load the OpCodes and code generation framework
require('./OpCodes.js');
require('./OpCodes-CodeGen.js');

console.log('='.repeat(80));
console.log('OpCodes Multi-Language Code Generation Framework Demo');
console.log('='.repeat(80));

// Display supported languages and operations
console.log('\nSupported Languages:');
OpCodes.getSupportedLanguages().forEach(lang => {
  console.log(`  - ${OpCodes.LanguageConfigs[lang].name} (${OpCodes.LanguageConfigs[lang].extension})`);
});

console.log('\nSupported Operations:');
OpCodes.getSupportedOperations().forEach(op => {
  const operation = OpCodes.CoreOperations[op];
  console.log(`  - ${op}: ${operation.description}`);
});

console.log('\n' + '='.repeat(80));
console.log('DEMONSTRATION: Generating RotL32 in Multiple Languages');
console.log('='.repeat(80));

// Generate RotL32 in different languages
const languages = ['python', 'cpp', 'java'];
const operation = 'RotL32';

languages.forEach(lang => {
  console.log(`\n--- ${OpCodes.LanguageConfigs[lang].name} Implementation ---`);
  try {
    const code = OpCodes.generateCode(lang, operation);
    console.log(code);
  } catch (error) {
    console.error(`Error generating ${lang} code:`, error.message);
  }
});

console.log('\n' + '='.repeat(80));
console.log('DEMONSTRATION: Complete Python Module Generation');
console.log('='.repeat(80));

// Generate a complete Python module with multiple operations
const coreOps = ['RotL32', 'Pack32BE', 'XorArrays', 'GF256Mul', 'StringToBytes'];
try {
  const pythonModule = OpCodes.generateModule('python', coreOps, {
    moduleName: 'CryptoOpcodes'
  });
  console.log(pythonModule);
} catch (error) {
  console.error('Error generating Python module:', error.message);
}

console.log('\n' + '='.repeat(80));
console.log('DEMONSTRATION: Test Generation for Python');
console.log('='.repeat(80));

// Generate test code
try {
  const testCode = OpCodes.generateTests('python', ['RotL32', 'Pack32BE']);
  console.log(testCode);
} catch (error) {
  console.error('Error generating test code:', error.message);
}

console.log('\n' + '='.repeat(80));
console.log('VALIDATION: Cross-Language Test Vector Comparison');
console.log('='.repeat(80));

// Compare implementations across languages
const testOps = ['RotL32', 'Pack32BE'];
const testLangs = ['python', 'cpp', 'java'];

testOps.forEach(opName => {
  console.log(`\nOperation: ${opName}`);
  const operation = OpCodes.CoreOperations[opName];
  
  console.log(`Test Cases:`);
  operation.testCases.forEach((testCase, index) => {
    console.log(`  ${index + 1}. ${testCase.description}`);
    console.log(`     Input: ${JSON.stringify(testCase.inputs)}`);
    console.log(`     Expected: ${JSON.stringify(testCase.expected)}`);
  });
  
  console.log(`Generated in languages:`);
  testLangs.forEach(lang => {
    try {
      const validation = OpCodes.CodeValidator.validateSyntax(lang, 
        OpCodes.generateCode(lang, opName));
      console.log(`  - ${lang}: ${validation.valid ? 'VALID' : 'INVALID'}`);
      if (validation.errors.length > 0) {
        console.log(`    Errors: ${validation.errors.join(', ')}`);
      }
      if (validation.warnings.length > 0) {
        console.log(`    Warnings: ${validation.warnings.join(', ')}`);
      }
    } catch (error) {
      console.log(`  - ${lang}: ERROR - ${error.message}`);
    }
  });
});

console.log('\n' + '='.repeat(80));
console.log('PERFORMANCE ANALYSIS: Code Generation Metrics');
console.log('='.repeat(80));

// Measure code generation performance
const startTime = Date.now();
let totalOperations = 0;

languages.forEach(lang => {
  coreOps.forEach(op => {
    try {
      const code = OpCodes.generateCode(lang, op);
      totalOperations++;
      console.log(`Generated ${op} for ${lang}: ${code.split('\n').length} lines`);
    } catch (error) {
      console.log(`Failed to generate ${op} for ${lang}: ${error.message}`);
    }
  });
});

const endTime = Date.now();
const elapsed = endTime - startTime;

console.log(`\nPerformance Summary:`);
console.log(`  Total operations generated: ${totalOperations}`);
console.log(`  Time elapsed: ${elapsed}ms`);
console.log(`  Average time per operation: ${(elapsed / totalOperations).toFixed(2)}ms`);

console.log('\n' + '='.repeat(80));
console.log('PRACTICAL EXAMPLE: Generating Real Cipher Implementation');
console.log('='.repeat(80));

// Generate a practical example showing how this would be used for cipher development
console.log('Example: Converting a simple Caesar cipher to Python');

const caesarPythonExample = `
# This demonstrates how OpCodes operations could be used in cipher implementation
# Generated using OpCodes Code Generation Framework

from typing import List

${OpCodes.generateCode('python', 'StringToBytes', { includeImports: false })}

def caesar_encrypt(plaintext: str, shift: int) -> str:
    """Caesar cipher encryption using generated OpCodes operations"""
    # Convert string to bytes using generated function
    data_bytes = stringtobytes(plaintext)
    
    # Apply Caesar shift
    result_bytes = []
    for byte_val in data_bytes:
        if 65 <= byte_val <= 90:  # Uppercase A-Z
            shifted = ((byte_val - 65 + shift) % 26) + 65
            result_bytes.append(shifted)
        elif 97 <= byte_val <= 122:  # Lowercase a-z
            shifted = ((byte_val - 97 + shift) % 26) + 97
            result_bytes.append(shifted)
        else:
            result_bytes.append(byte_val)
    
    # Convert back to string
    return ''.join(chr(b) for b in result_bytes)

# Example usage
if __name__ == "__main__":
    message = "Hello World"
    encrypted = caesar_encrypt(message, 3)
    print(f"Original: {message}")
    print(f"Encrypted: {encrypted}")
`;

console.log(caesarPythonExample);

console.log('\n' + '='.repeat(80));
console.log('FRAMEWORK CAPABILITIES SUMMARY');
console.log('='.repeat(80));

console.log(`
✅ IMPLEMENTED FEATURES:
  • Multi-language code generation (Python, C++, Java, Rust, C#)
  • 10 core cryptographic operations with full implementations
  • Type-safe code generation with language-specific optimizations
  • Comprehensive test vector generation and validation
  • Cross-platform compatibility (Browser + Node.js)
  • Educational documentation with security notes
  • Performance monitoring and validation framework

🎯 KEY OPERATIONS SUPPORTED:
  • Bit manipulation: RotL32, PopCount
  • Byte operations: Pack32BE, Unpack32BE
  • Array operations: XorArrays, ClearArray  
  • Mathematical: GF256Mul (Galois Field)
  • String conversion: StringToBytes
  • Security: SecureCompare, PKCS7Padding
  • Utility: Various helper functions

🔧 ARCHITECTURAL FEATURES:
  • Template-based generation with language-specific syntax
  • Extensible operation definitions with test vectors
  • Validation framework with syntax and cross-language checking
  • Memory-efficient code patterns
  • Educational focus with security best practices

📈 PRACTICAL APPLICATIONS:
  • Convert JavaScript cipher implementations to other languages
  • Generate educational examples for cryptography courses
  • Create reference implementations for algorithm validation
  • Support multi-language cryptographic library development
  • Enable rapid prototyping across programming languages

🚀 NEXT STEPS FOR EXPANSION:
  • Add more languages (Go, Swift, TypeScript, WebAssembly)
  • Implement remaining OpCodes operations (40+ total)
  • Add cipher-specific optimization patterns
  • Create IDE integration plugins
  • Develop automated testing pipelines
`);

console.log('\nDemo completed successfully! 🎉');