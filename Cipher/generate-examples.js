#!/usr/bin/env node
/*
 * Generate Example Code in Multiple Languages
 * Creates concrete examples of OpCodes operations in various programming languages
 * (c)2006-2025 Hawkynt
 */

const fs = require('fs');
const path = require('path');

// Load the OpCodes and code generation framework
require('./OpCodes.js');
require('./OpCodes-CodeGen.js');

console.log('Generating OpCodes examples in multiple languages...\n');

// Create examples directory
const examplesDir = path.join(__dirname, 'examples');
if (!fs.existsSync(examplesDir)) {
  fs.mkdirSync(examplesDir);
}

// Core operations to demonstrate
const demoOperations = ['RotL32', 'Pack32BE', 'XorArrays', 'StringToBytes', 'GF256Mul'];
const languages = ['python', 'cpp', 'java'];

// Generate complete modules for each language
languages.forEach(language => {
  console.log(`Generating ${OpCodes.LanguageConfigs[language].name} module...`);
  
  try {
    const moduleCode = OpCodes.generateModule(language, demoOperations, {
      moduleName: 'CryptoOpcodes'
    });
    
    const filename = `crypto_opcodes${OpCodes.LanguageConfigs[language].extension}`;
    const filepath = path.join(examplesDir, filename);
    
    fs.writeFileSync(filepath, moduleCode);
    console.log(`  ✅ Created: ${filename}`);
    
    // Generate test file
    const testCode = OpCodes.generateTests(language, demoOperations.slice(0, 3)); // First 3 for brevity
    const testFilename = `test_crypto_opcodes${OpCodes.LanguageConfigs[language].extension}`;
    const testFilepath = path.join(examplesDir, testFilename);
    
    fs.writeFileSync(testFilepath, testCode);
    console.log(`  ✅ Created: ${testFilename}`);
    
  } catch (error) {
    console.log(`  ❌ Error generating ${language}: ${error.message}`);
  }
});

// Generate a comprehensive example showing cipher usage
console.log('\nGenerating practical cipher examples...');

// Python Caesar cipher example
const pythonCaesarExample = `#!/usr/bin/env python3
"""
Caesar Cipher Implementation using Generated OpCodes
Demonstrates practical usage of the generated cryptographic operations
"""

${OpCodes.generateCode('python', 'StringToBytes', { includeImports: true })}

def caesar_encrypt(plaintext: str, shift: int = 3) -> str:
    """
    Encrypt text using Caesar cipher with generated OpCodes operations
    
    Args:
        plaintext: Text to encrypt
        shift: Number of positions to shift (default: 3)
    
    Returns:
        Encrypted text
    """
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
            result_bytes.append(byte_val)  # Non-alphabetic characters unchanged
    
    # Convert back to string
    return ''.join(chr(b) for b in result_bytes)

def caesar_decrypt(ciphertext: str, shift: int = 3) -> str:
    """Decrypt Caesar cipher by shifting in opposite direction"""
    return caesar_encrypt(ciphertext, -shift)

def demonstrate_operations():
    """Demonstrate various OpCodes operations"""
    print("=== OpCodes Operations Demonstration ===\\n")
    
    # String conversion
    test_string = "Hello, World!"
    bytes_result = stringtobytes(test_string)
    print(f"StringToBytes('{test_string}') = {bytes_result}")
    print(f"As hex: {' '.join(f'{b:02X}' for b in bytes_result)}\\n")
    
    # Caesar cipher demonstration
    plaintext = "The quick brown fox jumps over the lazy dog"
    encrypted = caesar_encrypt(plaintext, 3)
    decrypted = caesar_decrypt(encrypted, 3)
    
    print("=== Caesar Cipher Demonstration ===")
    print(f"Original:  {plaintext}")
    print(f"Encrypted: {encrypted}")
    print(f"Decrypted: {decrypted}")
    print(f"Match: {'✅' if plaintext == decrypted else '❌'}\\n")

if __name__ == "__main__":
    demonstrate_operations()
`;

fs.writeFileSync(path.join(examplesDir, 'caesar_cipher_demo.py'), pythonCaesarExample);
console.log('  ✅ Created: caesar_cipher_demo.py');

// C++ example
const cppExample = `/*
 * OpCodes C++ Example - Cryptographic Operations
 * Generated using OpCodes Multi-Language Framework
 */

#include <iostream>
#include <vector>
#include <string>
#include <iomanip>

${OpCodes.generateCode('cpp', 'RotL32', { includeImports: true })}

${OpCodes.generateCode('cpp', 'StringToBytes', { includeImports: false })}

void demonstrateOperations() {
    std::cout << "=== OpCodes C++ Operations Demonstration ===" << std::endl << std::endl;
    
    // RotL32 demonstration
    uint32_t value = 0x12345678;
    uint8_t positions = 4;
    uint32_t result = rotl32(value, positions);
    
    std::cout << "RotL32 Demonstration:" << std::endl;
    std::cout << "Input:  0x" << std::hex << std::uppercase << value << std::endl;
    std::cout << "Shift:  " << std::dec << static_cast<int>(positions) << " positions" << std::endl;
    std::cout << "Result: 0x" << std::hex << std::uppercase << result << std::endl << std::endl;
    
    // String to bytes demonstration
    std::string testString = "Hello, C++!";
    auto bytes = stringtobytes(testString);
    
    std::cout << "StringToBytes Demonstration:" << std::endl;
    std::cout << "Input:  \\"" << testString << "\\"" << std::endl;
    std::cout << "Bytes:  ";
    for (size_t i = 0; i < bytes.size(); ++i) {
        std::cout << "0x" << std::hex << std::uppercase << std::setw(2) << std::setfill('0') 
                  << static_cast<int>(bytes[i]);
        if (i < bytes.size() - 1) std::cout << " ";
    }
    std::cout << std::endl;
}

int main() {
    demonstrateOperations();
    return 0;
}
`;

fs.writeFileSync(path.join(examplesDir, 'opcodes_demo.cpp'), cppExample);
console.log('  ✅ Created: opcodes_demo.cpp');

// Java example  
const javaExample = `/*
 * OpCodes Java Example - Cryptographic Operations
 * Generated using OpCodes Multi-Language Framework
 */

${OpCodes.generateCode('java', 'Pack32BE', { includeImports: true })}

${OpCodes.generateCode('java', 'XorArrays', { includeImports: false })}

public class OpCodesDemo {
    
    public static void demonstrateOperations() {
        System.out.println("=== OpCodes Java Operations Demonstration ===\\n");
        
        // Pack32BE demonstration
        int b0 = 0x12, b1 = 0x34, b2 = 0x56, b3 = 0x78;
        int packed = pack32be(b0, b1, b2, b3);
        
        System.out.println("Pack32BE Demonstration:");
        System.out.printf("Input bytes: 0x%02X 0x%02X 0x%02X 0x%02X%n", b0, b1, b2, b3);
        System.out.printf("Packed word: 0x%08X%n%n", packed);
        
        // XorArrays demonstration
        int[] array1 = {0x12, 0x34, 0x56, 0x78};
        int[] array2 = {0xAB, 0xCD, 0xEF, 0x12};
        int[] xorResult = xorarrays(array1, array2);
        
        System.out.println("XorArrays Demonstration:");
        System.out.print("Array 1: ");
        for (int b : array1) System.out.printf("0x%02X ", b);
        System.out.println();
        
        System.out.print("Array 2: ");
        for (int b : array2) System.out.printf("0x%02X ", b);
        System.out.println();
        
        System.out.print("XOR Result: ");
        for (int b : xorResult) System.out.printf("0x%02X ", b);
        System.out.println("\\n");
    }
    
    public static void main(String[] args) {
        demonstrateOperations();
    }
}
`;

fs.writeFileSync(path.join(examplesDir, 'OpCodesDemo.java'), javaExample);
console.log('  ✅ Created: OpCodesDemo.java');

// Create a comprehensive README for the examples
const readmeContent = `# OpCodes Multi-Language Examples

This directory contains generated examples of cryptographic operations converted from the JavaScript OpCodes library to multiple programming languages.

## Generated Files

### Core Modules
- **crypto_opcodes.py** - Python implementation of core OpCodes operations
- **crypto_opcodes.cpp** - C++ implementation with performance optimizations  
- **crypto_opcodes.java** - Java implementation with strong typing

### Test Files
- **test_crypto_opcodes.py** - Python unit tests using unittest framework
- **test_crypto_opcodes.cpp** - C++ test implementation
- **test_crypto_opcodes.java** - Java JUnit-style tests

### Practical Examples
- **caesar_cipher_demo.py** - Complete Caesar cipher using generated operations
- **opcodes_demo.cpp** - C++ demonstration of bit manipulation operations
- **OpCodesDemo.java** - Java example showing byte packing and XOR operations

## Supported Operations

The generated code includes implementations for:

1. **RotL32** - 32-bit left rotation (bit manipulation)
2. **Pack32BE** - Pack 4 bytes into 32-bit word (big-endian)
3. **XorArrays** - XOR two byte arrays (fundamental crypto operation)
4. **StringToBytes** - Convert strings to byte arrays for processing
5. **GF256Mul** - Galois Field multiplication (used in AES)

## Running the Examples

### Python
\`\`\`bash
# Run Caesar cipher demonstration
python3 caesar_cipher_demo.py

# Run unit tests
python3 test_crypto_opcodes.py
\`\`\`

### C++
\`\`\`bash
# Compile and run demo (requires C++11 or later)
g++ -std=c++11 -o opcodes_demo opcodes_demo.cpp
./opcodes_demo
\`\`\`

### Java
\`\`\`bash
# Compile and run demo
javac OpCodesDemo.java
java OpCodesDemo
\`\`\`

## Key Features Demonstrated

### Type Safety
- **Python**: Type hints and proper error handling
- **C++**: Strong typing with uint8_t/uint32_t types
- **Java**: Integer arrays with bounds checking

### Performance Optimizations
- **Python**: List comprehensions for array operations
- **C++**: Move semantics and const references where applicable
- **Java**: Primitive arrays for better performance

### Educational Value
- Comprehensive documentation and comments
- Clear variable naming and code structure
- Security considerations and best practices noted
- Cross-language consistency for learning

## Architecture Notes

The generated code follows these principles:

1. **Cross-Platform Compatibility** - Identical behavior across languages
2. **Educational Focus** - Clear, readable implementations for learning
3. **Security Awareness** - Constant-time operations where applicable
4. **Performance Consciousness** - Language-appropriate optimizations

## Generated vs Manual Implementation

These implementations were automatically generated from the JavaScript OpCodes library using the OpCodes-CodeGen framework. The generator ensures:

- **Consistency**: Same algorithms across all languages
- **Correctness**: Validated against known test vectors
- **Maintainability**: Single source of truth in OpCodes.js
- **Extensibility**: Easy to add new languages and operations

## Next Steps

To extend this framework:

1. Add more languages (Rust, Go, Swift, etc.)
2. Implement remaining OpCodes operations (40+ total)
3. Add cipher-specific optimizations
4. Create language-specific package managers integration
5. Generate IDE completion and documentation

## Educational Use

These examples are perfect for:
- Computer science courses on cryptography
- Multi-language programming tutorials  
- Algorithm implementation comparison studies
- Cryptographic library development reference
- Cross-platform development learning

⚠️ **Important**: These are educational implementations. Use established cryptographic libraries for production systems.
`;

fs.writeFileSync(path.join(examplesDir, 'README.md'), readmeContent);
console.log('  ✅ Created: README.md');

console.log(`\n🎉 Generated ${fs.readdirSync(examplesDir).length} example files in ./examples/`);
console.log('\nGenerated files:');
fs.readdirSync(examplesDir).forEach(file => {
  const stats = fs.statSync(path.join(examplesDir, file));
  console.log(`  📄 ${file} (${stats.size} bytes)`);
});

console.log('\n✨ Examples generation completed successfully!');