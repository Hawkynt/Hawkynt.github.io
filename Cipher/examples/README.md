# OpCodes Multi-Language Examples

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
```bash
# Run Caesar cipher demonstration
python3 caesar_cipher_demo.py

# Run unit tests
python3 test_crypto_opcodes.py
```

### C++
```bash
# Compile and run demo (requires C++11 or later)
g++ -std=c++11 -o opcodes_demo opcodes_demo.cpp
./opcodes_demo
```

### Java
```bash
# Compile and run demo
javac OpCodesDemo.java
java OpCodesDemo
```

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
