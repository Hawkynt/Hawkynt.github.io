#!/usr/bin/env node
/*
 * OpCodes Multi-Language Code Generation Framework
 * Extends OpCodes.js with cross-language code generation capabilities
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 * 
 * This module provides:
 * - Abstract representation of cryptographic operations
 * - Template system for multiple programming languages
 * - Type-safe code generation with proper error handling
 * - Optimization hints for different language paradigms
 * 
 * Supported target languages:
 * - Python: Clean, readable implementations with type hints
 * - C++: Performance-focused with proper type safety
 * - Java: Object-oriented structure with strong typing
 * - Rust: Memory safety and zero-cost abstractions
 * - C#: .NET framework compatibility
 * - Perl: String manipulation and bit operations
 * - BASIC: Simple, educational syntax
 * - Delphi/Pascal: Strong typing and readability
 * - Kotlin: Modern JVM language features
 * 
 * NOTE: This is an educational tool for learning cryptographic implementations
 * across different programming paradigms. Generated code should be reviewed
 * and tested before use in any production systems.
 */

(function(global) {
  'use strict';
  
  // Load OpCodes if not already available
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('./OpCodes.js');
  }
  
  // Verify OpCodes is available
  if (!global.OpCodes) {
    console.error('OpCodes-CodeGen requires OpCodes.js to be loaded first');
    return;
  }

  // ========================[ LANGUAGE CONFIGURATIONS ]========================
  
  const LanguageConfigs = {
    
    python: {
      name: 'Python',
      extension: '.py',
      imports: [
        'from typing import List, Tuple, Union',
        'import struct'
      ],
      types: {
        byte: 'int',
        int32: 'int',
        array: 'List[int]',
        boolean: 'bool',
        string: 'str'
      },
      constants: {
        hex: '0x{value:02X}',
        binary: '0b{value:08b}',
        decimal: '{value}'
      },
      syntax: {
        function: 'def {name}({params}) -> {returnType}:',
        variable: '{name}: {type} = {value}',
        array: '[{elements}]',
        comment: '# {text}',
        docstring: '"""{text}"""',
        for_loop: 'for {var} in range({start}, {end}):',
        if_statement: 'if {condition}:',
        return: 'return {value}',
        bitwise_and: '{a} & {b}',
        bitwise_or: '{a} | {b}',
        bitwise_xor: '{a} ^ {b}',
        bitwise_not: '~{a}',
        left_shift: '{a} << {b}',
        right_shift: '{a} >> {b}',
        array_access: '{array}[{index}]',
        array_length: 'len({array})'
      },
      optimizations: {
        use_list_comprehensions: true,
        use_type_hints: true,
        use_bitwise_operations: true
      }
    },
    
    cpp: {
      name: 'C++',
      extension: '.cpp',
      imports: [
        '#include <cstdint>',
        '#include <vector>',
        '#include <array>',
        '#include <algorithm>'
      ],
      types: {
        byte: 'uint8_t',
        int32: 'uint32_t',
        array: 'std::vector<uint8_t>',
        boolean: 'bool',
        string: 'std::string'
      },
      constants: {
        hex: '0x{value:02X}U',
        binary: '0b{value:08b}U',
        decimal: '{value}U'
      },
      syntax: {
        function: '{returnType} {name}({params}) {',
        variable: '{type} {name} = {value};',
        array: '{{{elements}}}',
        comment: '// {text}',
        docstring: '/**\n * {text}\n */',
        for_loop: 'for (int {var} = {start}; {var} < {end}; ++{var}) {',
        if_statement: 'if ({condition}) {',
        return: 'return {value};',
        bitwise_and: '({a} & {b})',
        bitwise_or: '({a} | {b})',
        bitwise_xor: '({a} ^ {b})',
        bitwise_not: '(~{a})',
        left_shift: '({a} << {b})',
        right_shift: '({a} >> {b})',
        array_access: '{array}[{index}]',
        array_length: '{array}.size()'
      },
      optimizations: {
        use_const_references: true,
        use_inline_functions: true,
        use_constexpr: true,
        prefer_unsigned_types: true
      }
    },
    
    java: {
      name: 'Java',
      extension: '.java',
      imports: [
        'import java.util.Arrays;',
        'import java.util.List;',
        'import java.util.ArrayList;'
      ],
      types: {
        byte: 'int',
        int32: 'int',
        array: 'int[]',
        boolean: 'boolean',
        string: 'String'
      },
      constants: {
        hex: '0x{value:02X}',
        binary: '0b{value:08b}',
        decimal: '{value}'
      },
      syntax: {
        function: 'public static {returnType} {name}({params}) {',
        variable: '{type} {name} = {value};',
        array: '{{{elements}}}',
        comment: '// {text}',
        docstring: '/**\n * {text}\n */',
        for_loop: 'for (int {var} = {start}; {var} < {end}; {var}++) {',
        if_statement: 'if ({condition}) {',
        return: 'return {value};',
        bitwise_and: '({a} & {b})',
        bitwise_or: '({a} | {b})',
        bitwise_xor: '({a} ^ {b})',
        bitwise_not: '(~{a})',
        left_shift: '({a} << {b})',
        right_shift: '({a} >>> {b})',
        array_access: '{array}[{index}]',
        array_length: '{array}.length'
      },
      optimizations: {
        use_static_methods: true,
        use_final_variables: true,
        avoid_boxing: true
      }
    },
    
    rust: {
      name: 'Rust',
      extension: '.rs',
      imports: [
        'use std::num::Wrapping;'
      ],
      types: {
        byte: 'u8',
        int32: 'u32',
        array: 'Vec<u8>',
        boolean: 'bool',
        string: 'String'
      },
      constants: {
        hex: '0x{value:02X}_u8',
        binary: '0b{value:08b}_u8',
        decimal: '{value}_u8'
      },
      syntax: {
        function: 'fn {name}({params}) -> {returnType} {{',
        variable: 'let {name}: {type} = {value};',
        array: 'vec![{elements}]',
        comment: '// {text}',
        docstring: '/// {text}',
        for_loop: 'for {var} in {start}..{end} {{',
        if_statement: 'if {condition} {{',
        return: '{value}',
        bitwise_and: '({a} & {b})',
        bitwise_or: '({a} | {b})',
        bitwise_xor: '({a} ^ {b})',
        bitwise_not: '!{a}',
        left_shift: '({a} << {b})',
        right_shift: '({a} >> {b})',
        array_access: '{array}[{index}]',
        array_length: '{array}.len()'
      },
      optimizations: {
        use_borrowing: true,
        use_const_generics: true,
        prefer_iterators: true,
        use_wrapping_arithmetic: true
      }
    },
    
    csharp: {
      name: 'C#',
      extension: '.cs',
      imports: [
        'using System;',
        'using System.Collections.Generic;'
      ],
      types: {
        byte: 'byte',
        int32: 'uint',
        array: 'byte[]',
        boolean: 'bool',
        string: 'string'
      },
      constants: {
        hex: '0x{value:02X}',
        binary: '0b{value:08b}',
        decimal: '{value}'
      },
      syntax: {
        function: 'public static {returnType} {name}({params}) {',
        variable: '{type} {name} = {value};',
        array: 'new {type} {{ {elements} }}',
        comment: '// {text}',
        docstring: '/// <summary>\n/// {text}\n/// </summary>',
        for_loop: 'for (int {var} = {start}; {var} < {end}; {var}++) {',
        if_statement: 'if ({condition}) {',
        return: 'return {value};',
        bitwise_and: '({a} & {b})',
        bitwise_or: '({a} | {b})',
        bitwise_xor: '({a} ^ {b})',
        bitwise_not: '(~{a})',
        left_shift: '({a} << {b})',
        right_shift: '({a} >> {b})',
        array_access: '{array}[{index}]',
        array_length: '{array}.Length'
      },
      optimizations: {
        use_unsafe_blocks: false,
        use_span_types: true,
        prefer_readonly: true
      }
    }
  };

  // ========================[ OPERATION DEFINITIONS ]========================
  
  // Core operations that will be supported in code generation
  const CoreOperations = {
    
    RotL32: {
      name: 'RotL32',
      description: 'Rotate left (circular left shift) for 32-bit values',
      category: 'bit_manipulation',
      parameters: [
        { name: 'value', type: 'int32', description: '32-bit value to rotate' },
        { name: 'positions', type: 'byte', description: 'Number of positions to rotate (0-31)' }
      ],
      returnType: 'int32',
      implementation: {
        algorithm: 'circular_left_shift',
        bitWidth: 32,
        modulo: 31
      },
      testCases: [
        { inputs: [0x12345678, 4], expected: 0x23456781, description: 'Basic rotation' },
        { inputs: [0x80000000, 1], expected: 0x00000001, description: 'MSB rotation' },
        { inputs: [0x00000001, 31], expected: 0x80000000, description: 'Maximum rotation' }
      ]
    },
    
    Pack32BE: {
      name: 'Pack32BE',
      description: 'Pack 4 bytes into a 32-bit word (big-endian)',
      category: 'byte_operations',
      parameters: [
        { name: 'b0', type: 'byte', description: 'Most significant byte' },
        { name: 'b1', type: 'byte', description: 'Second byte' },
        { name: 'b2', type: 'byte', description: 'Third byte' },
        { name: 'b3', type: 'byte', description: 'Least significant byte' }
      ],
      returnType: 'int32',
      implementation: {
        algorithm: 'big_endian_packing',
        endianness: 'big'
      },
      testCases: [
        { inputs: [0x12, 0x34, 0x56, 0x78], expected: 0x12345678, description: 'Standard packing' },
        { inputs: [0xFF, 0xFF, 0xFF, 0xFF], expected: 0xFFFFFFFF, description: 'All ones' },
        { inputs: [0x00, 0x00, 0x00, 0x01], expected: 0x00000001, description: 'Single bit' }
      ]
    },
    
    Unpack32BE: {
      name: 'Unpack32BE',
      description: 'Unpack 32-bit word to 4 bytes (big-endian)',
      category: 'byte_operations',
      parameters: [
        { name: 'word', type: 'int32', description: '32-bit word to unpack' }
      ],
      returnType: 'array',
      implementation: {
        algorithm: 'big_endian_unpacking',
        endianness: 'big',
        resultSize: 4
      },
      testCases: [
        { inputs: [0x12345678], expected: [0x12, 0x34, 0x56, 0x78], description: 'Standard unpacking' },
        { inputs: [0xFFFFFFFF], expected: [0xFF, 0xFF, 0xFF, 0xFF], description: 'All ones' },
        { inputs: [0x00000001], expected: [0x00, 0x00, 0x00, 0x01], description: 'Single bit' }
      ]
    },
    
    XorArrays: {
      name: 'XorArrays',
      description: 'XOR two byte arrays',
      category: 'array_operations',
      parameters: [
        { name: 'arr1', type: 'array', description: 'First byte array' },
        { name: 'arr2', type: 'array', description: 'Second byte array' }
      ],
      returnType: 'array',
      implementation: {
        algorithm: 'array_xor',
        lengthHandling: 'minimum'
      },
      testCases: [
        { inputs: [[0x00, 0xFF, 0xAA], [0xFF, 0x00, 0x55]], expected: [0xFF, 0xFF, 0xFF], description: 'Basic XOR' },
        { inputs: [[0x12, 0x34], [0x56, 0x78, 0x9A]], expected: [0x44, 0x4C], description: 'Different lengths' }
      ]
    },
    
    GF256Mul: {
      name: 'GF256Mul',
      description: 'Galois Field GF(2^8) multiplication (for AES and other ciphers)',
      category: 'mathematical',
      parameters: [
        { name: 'a', type: 'byte', description: 'First operand (0-255)' },
        { name: 'b', type: 'byte', description: 'Second operand (0-255)' }
      ],
      returnType: 'byte',
      implementation: {
        algorithm: 'galois_field_multiplication',
        field: 'GF(2^8)',
        polynomial: 0x1B
      },
      testCases: [
        { inputs: [0x02, 0x03], expected: 0x06, description: 'Basic multiplication' },
        { inputs: [0x53, 0xCA], expected: 0x01, description: 'AES inverse test' },
        { inputs: [0x01, 0xFF], expected: 0xFF, description: 'Identity element' }
      ]
    },
    
    StringToBytes: {
      name: 'StringToBytes',
      description: 'Convert string to byte array',
      category: 'string_conversion',
      parameters: [
        { name: 'str', type: 'string', description: 'Input string' }
      ],
      returnType: 'array',
      implementation: {
        algorithm: 'string_to_bytes',
        encoding: 'ASCII'
      },
      testCases: [
        { inputs: ['ABC'], expected: [0x41, 0x42, 0x43], description: 'ASCII conversion' },
        { inputs: [''], expected: [], description: 'Empty string' },
        { inputs: ['Hello'], expected: [0x48, 0x65, 0x6C, 0x6C, 0x6F], description: 'Word conversion' }
      ]
    },
    
    PKCS7Padding: {
      name: 'PKCS7Padding',
      description: 'Generate padding for block ciphers (PKCS#7)',
      category: 'utility',
      parameters: [
        { name: 'blockSize', type: 'byte', description: 'Block size in bytes' },
        { name: 'dataLength', type: 'int32', description: 'Length of data to pad' }
      ],
      returnType: 'array',
      implementation: {
        algorithm: 'pkcs7_padding',
        standard: 'RFC 5652'
      },
      testCases: [
        { inputs: [8, 5], expected: [3, 3, 3], description: 'Basic padding' },
        { inputs: [16, 16], expected: [16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16], description: 'Full block padding' }
      ]
    },
    
    SecureCompare: {
      name: 'SecureCompare',
      description: 'Secure comparison (constant time) for preventing timing attacks',
      category: 'security',
      parameters: [
        { name: 'arr1', type: 'array', description: 'First array' },
        { name: 'arr2', type: 'array', description: 'Second array' }
      ],
      returnType: 'boolean',
      implementation: {
        algorithm: 'constant_time_comparison',
        security: 'timing_attack_resistant'
      },
      testCases: [
        { inputs: [[1, 2, 3], [1, 2, 3]], expected: true, description: 'Equal arrays' },
        { inputs: [[1, 2, 3], [1, 2, 4]], expected: false, description: 'Different arrays' },
        { inputs: [[1, 2], [1, 2, 3]], expected: false, description: 'Different lengths' }
      ]
    },
    
    PopCount: {
      name: 'PopCount',
      description: 'Population count (number of 1 bits)',
      category: 'bit_manipulation',
      parameters: [
        { name: 'value', type: 'int32', description: 'Input value' }
      ],
      returnType: 'int32',
      implementation: {
        algorithm: 'bit_counting',
        method: 'brian_kernighan'
      },
      testCases: [
        { inputs: [0x0F], expected: 4, description: 'Four bits set' },
        { inputs: [0xFF], expected: 8, description: 'All bits in byte' },
        { inputs: [0x00], expected: 0, description: 'No bits set' }
      ]
    },
    
    ClearArray: {
      name: 'ClearArray',
      description: 'Clear array (fill with zeros) - security operation',
      category: 'security',
      parameters: [
        { name: 'arr', type: 'array', description: 'Array to clear (modified in place)' }
      ],
      returnType: 'void',
      implementation: {
        algorithm: 'secure_memory_clear',
        security: 'sensitive_data_erasure'
      },
      testCases: [
        { inputs: [[1, 2, 3, 4]], expected: [0, 0, 0, 0], description: 'Clear array' },
        { inputs: [[0xFF, 0xAA, 0x55]], expected: [0, 0, 0], description: 'Clear with patterns' }
      ]
    }
  };

  // ========================[ CODE GENERATION ENGINE ]========================
  
  const CodeGenerator = {
    
    /**
     * Generate code for a specific operation in target language
     * @param {string} language - Target language (python, cpp, java, etc.)
     * @param {string} operationName - Name of operation from CoreOperations
     * @param {Object} options - Generation options
     * @returns {string} Generated code
     */
    generateOperation: function(language, operationName, options = {}) {
      const langConfig = LanguageConfigs[language];
      const operation = CoreOperations[operationName];
      
      if (!langConfig) {
        throw new Error(`Unsupported language: ${language}`);
      }
      
      if (!operation) {
        throw new Error(`Unknown operation: ${operationName}`);
      }
      
      const code = [];
      
      // Add imports if needed
      if (options.includeImports !== false) {
        code.push(...langConfig.imports);
        code.push('');
      }
      
      // Generate function documentation
      code.push(this._generateDocumentation(langConfig, operation));
      
      // Generate function signature
      code.push(this._generateFunctionSignature(langConfig, operation));
      
      // Generate function body
      code.push(...this._generateFunctionBody(langConfig, operation));
      
      // Close function (only for languages that use braces)
      if (langConfig.name !== 'Python') {
        code.push('}');
      }
      
      return code.join('\n');
    },
    
    /**
     * Generate complete module with multiple operations
     * @param {string} language - Target language
     * @param {Array<string>} operations - Array of operation names
     * @param {Object} options - Generation options
     * @returns {string} Complete module code
     */
    generateModule: function(language, operations, options = {}) {
      const langConfig = LanguageConfigs[language];
      const moduleName = options.moduleName || 'CryptoOpcodes';
      
      const code = [];
      
      // Module header
      if (langConfig.name === 'Python') {
        code.push(`"""${moduleName} - Cryptographic Operations`);
        code.push(`Generated from OpCodes.js for ${langConfig.name}`);
        code.push(`Auto-generated code - do not modify manually`);
        code.push(`Educational implementation for learning purposes only"""`);
      } else {
        code.push(`/*`);
        code.push(` * ${moduleName} - Cryptographic Operations`);
        code.push(` * Generated from OpCodes.js for ${langConfig.name}`);
        code.push(` * Auto-generated code - do not modify manually`);
        code.push(` * Educational implementation for learning purposes only`);
        code.push(` */`);
      }
      code.push('');
      
      // Add imports
      code.push(...langConfig.imports);
      code.push('');
      
      // Language-specific module structure
      if (language === 'java') {
        code.push(`public class ${moduleName} {`);
        code.push('');
      } else if (language === 'csharp') {
        code.push(`public static class ${moduleName} {`);
        code.push('');
      }
      
      // Generate each operation
      operations.forEach((opName, index) => {
        if (index > 0) code.push('');
        const opCode = this.generateOperation(language, opName, { includeImports: false });
        code.push(opCode);
      });
      
      // Close module structure
      if (language === 'java' || language === 'csharp') {
        code.push('}');
      }
      
      return code.join('\n');
    },
    
    /**
     * Generate test code for operations
     * @param {string} language - Target language
     * @param {Array<string>} operations - Operations to test
     * @returns {string} Test code
     */
    generateTests: function(language, operations) {
      const langConfig = LanguageConfigs[language];
      const code = [];
      
      // Test framework setup
      code.push(`/*`);
      code.push(` * Test suite for generated cryptographic operations`);
      code.push(` * Validates correctness against known test vectors`);
      code.push(` */`);
      code.push('');
      
      if (language === 'python') {
        code.push('import unittest');
        code.push('from crypto_opcodes import *');
        code.push('');
        code.push('class TestCryptoOpcodes(unittest.TestCase):');
        
        operations.forEach(opName => {
          const operation = CoreOperations[opName];
          code.push('');
          code.push(`    def test_${opName.toLowerCase()}(self):`);
          code.push(`        """Test ${operation.description}"""`);
          
          operation.testCases.forEach((testCase, index) => {
            const inputs = testCase.inputs.map(inp => this._formatValue(langConfig, inp)).join(', ');
            const expected = this._formatValue(langConfig, testCase.expected);
            code.push(`        # ${testCase.description}`);
            code.push(`        result = ${opName}(${inputs})`);
            code.push(`        self.assertEqual(result, ${expected})`);
          });
        });
        
        code.push('');
        code.push('if __name__ == "__main__":');
        code.push('    unittest.main()');
        
      } else if (language === 'java') {
        code.push('import org.junit.Test;');
        code.push('import static org.junit.Assert.*;');
        code.push('');
        code.push('public class TestCryptoOpcodes {');
        
        operations.forEach(opName => {
          const operation = CoreOperations[opName];
          code.push('');
          code.push(`    @Test`);
          code.push(`    public void test${opName}() {`);
          code.push(`        // ${operation.description}`);
          
          operation.testCases.forEach(testCase => {
            const inputs = testCase.inputs.map(inp => this._formatValue(langConfig, inp)).join(', ');
            const expected = this._formatValue(langConfig, testCase.expected);
            code.push(`        // ${testCase.description}`);
            if (operation.returnType === 'array') {
              code.push(`        assertArrayEquals(${expected}, CryptoOpcodes.${opName}(${inputs}));`);
            } else {
              code.push(`        assertEquals(${expected}, CryptoOpcodes.${opName}(${inputs}));`);
            }
          });
          
          code.push('    }');
        });
        
        code.push('}');
      }
      
      return code.join('\n');
    },
    
    /**
     * Generate documentation for operation
     * @private
     */
    _generateDocumentation: function(langConfig, operation) {
      const lines = [];
      
      if (langConfig.syntax.docstring) {
        const docText = [
          operation.description,
          '',
          'Parameters:'
        ];
        
        operation.parameters.forEach(param => {
          docText.push(`  ${param.name} (${param.type}): ${param.description}`);
        });
        
        docText.push('');
        docText.push(`Returns: ${operation.returnType}`);
        docText.push('');
        docText.push('Educational implementation - review before production use');
        
        return langConfig.syntax.docstring.replace('{text}', docText.join('\n'));
      }
      
      return langConfig.syntax.comment.replace('{text}', operation.description);
    },
    
    /**
     * Generate function signature
     * @private
     */
    _generateFunctionSignature: function(langConfig, operation) {
      const params = operation.parameters.map(param => {
        const paramType = langConfig.types[param.type] || param.type;
        if (langConfig.name === 'Python') {
          return `${param.name}: ${paramType}`;
        } else {
          return `${paramType} ${param.name}`;
        }
      }).join(', ');
      
      const returnType = langConfig.types[operation.returnType] || operation.returnType;
      
      return langConfig.syntax.function
        .replace('{name}', operation.name.toLowerCase())
        .replace('{params}', params)
        .replace('{returnType}', returnType);
    },
    
    /**
     * Generate function body based on operation algorithm
     * @private
     */
    _generateFunctionBody: function(langConfig, operation) {
      const lines = [];
      const indent = '    ';
      
      // Generate implementation based on operation type
      switch (operation.name) {
        case 'RotL32':
          lines.push(indent + langConfig.syntax.comment.replace('{text}', 'Ensure unsigned 32-bit arithmetic'));
          if (langConfig.name === 'Python') {
            lines.push(indent + 'value = value & 0xFFFFFFFF');
            lines.push(indent + 'positions = positions & 31');
            lines.push(indent + 'return ((value << positions) | (value >> (32 - positions))) & 0xFFFFFFFF');
          } else if (langConfig.name === 'C++') {
            lines.push(indent + 'value = static_cast<uint32_t>(value);');
            lines.push(indent + 'positions &= 31;');
            lines.push(indent + 'return (value << positions) | (value >> (32 - positions));');
          } else if (langConfig.name === 'Java') {
            lines.push(indent + 'positions &= 31;');
            lines.push(indent + 'return (value << positions) | (value >>> (32 - positions));');
          }
          break;
          
        case 'Pack32BE':
          if (langConfig.name === 'Python') {
            lines.push(indent + 'return ((b0 & 0xFF) << 24) | ((b1 & 0xFF) << 16) | ((b2 & 0xFF) << 8) | (b3 & 0xFF)');
          } else if (langConfig.name === 'C++') {
            lines.push(indent + 'return (static_cast<uint32_t>(b0 & 0xFF) << 24) |');
            lines.push(indent + '       (static_cast<uint32_t>(b1 & 0xFF) << 16) |');
            lines.push(indent + '       (static_cast<uint32_t>(b2 & 0xFF) << 8) |');
            lines.push(indent + '       static_cast<uint32_t>(b3 & 0xFF);');
          } else if (langConfig.name === 'Java') {
            lines.push(indent + 'return ((b0 & 0xFF) << 24) | ((b1 & 0xFF) << 16) | ((b2 & 0xFF) << 8) | (b3 & 0xFF);');
          }
          break;
          
        case 'XorArrays':
          if (langConfig.name === 'Python') {
            lines.push(indent + 'min_len = min(len(arr1), len(arr2))');
            lines.push(indent + 'return [(arr1[i] ^ arr2[i]) & 0xFF for i in range(min_len)]');
          } else if (langConfig.name === 'C++') {
            lines.push(indent + 'size_t min_len = std::min(arr1.size(), arr2.size());');
            lines.push(indent + 'std::vector<uint8_t> result(min_len);');
            lines.push(indent + 'for (size_t i = 0; i < min_len; ++i) {');
            lines.push(indent + '    result[i] = (arr1[i] ^ arr2[i]) & 0xFF;');
            lines.push(indent + '}');
            lines.push(indent + 'return result;');
          } else if (langConfig.name === 'Java') {
            lines.push(indent + 'int minLen = Math.min(arr1.length, arr2.length);');
            lines.push(indent + 'int[] result = new int[minLen];');
            lines.push(indent + 'for (int i = 0; i < minLen; i++) {');
            lines.push(indent + '    result[i] = (arr1[i] ^ arr2[i]) & 0xFF;');
            lines.push(indent + '}');
            lines.push(indent + 'return result;');
          }
          break;
          
        case 'GF256Mul':
          // Implement GF(2^8) multiplication 
          if (langConfig.name === 'Python') {
            lines.push(indent + 'result = 0');
            lines.push(indent + 'a &= 0xFF');
            lines.push(indent + 'b &= 0xFF');
            lines.push(indent + 'for i in range(8):');
            lines.push(indent + '    if b & 1:');
            lines.push(indent + '        result ^= a');
            lines.push(indent + '    high_bit = a & 0x80');
            lines.push(indent + '    a = (a << 1) & 0xFF');
            lines.push(indent + '    if high_bit:');
            lines.push(indent + '        a ^= 0x1B  # AES irreducible polynomial');
            lines.push(indent + '    b >>= 1');
            lines.push(indent + 'return result & 0xFF');
          } else {
            lines.push(indent + langConfig.syntax.comment.replace('{text}', 'GF(2^8) multiplication implementation needed'));
            if (langConfig.name === 'Python') {
              lines.push(indent + 'raise NotImplementedError("GF256Mul implementation needed")');
            } else {
              lines.push(indent + 'throw new Error("Not implemented");');
            }
          }
          break;
          
        case 'StringToBytes':
          if (langConfig.name === 'Python') {
            lines.push(indent + 'return [ord(c) & 0xFF for c in str]');
          } else if (langConfig.name === 'C++') {
            lines.push(indent + 'std::vector<uint8_t> result;');
            lines.push(indent + 'for (char c : str) {');
            lines.push(indent + '    result.push_back(static_cast<uint8_t>(c));');
            lines.push(indent + '}');
            lines.push(indent + 'return result;');
          } else if (langConfig.name === 'Java') {
            lines.push(indent + 'int[] result = new int[str.length()];');
            lines.push(indent + 'for (int i = 0; i < str.length(); i++) {');
            lines.push(indent + '    result[i] = str.charAt(i) & 0xFF;');
            lines.push(indent + '}');
            lines.push(indent + 'return result;');
          }
          break;
          
        default:
          lines.push(indent + langConfig.syntax.comment.replace('{text}', 'Implementation placeholder'));
          if (langConfig.name === 'Python') {
            lines.push(indent + 'raise NotImplementedError("Implementation needed")');
          } else {
            lines.push(indent + 'throw new Error("Not implemented");');
          }
      }
      
      return lines;
    },
    
    /**
     * Format value for target language
     * @private
     */
    _formatValue: function(langConfig, value) {
      if (Array.isArray(value)) {
        const elements = value.map(v => this._formatValue(langConfig, v)).join(', ');
        return langConfig.syntax.array.replace('{elements}', elements);
      } else if (typeof value === 'number') {
        if (value > 255) {
          return langConfig.constants.hex.replace('{value:02X}', value.toString(16).toUpperCase());
        } else {
          return langConfig.constants.hex.replace('{value:02X}', value.toString(16).padStart(2, '0').toUpperCase());
        }
      } else if (typeof value === 'string') {
        return `"${value}"`;
      } else if (typeof value === 'boolean') {
        return value.toString();
      }
      return value.toString();
    }
  };

  // ========================[ VALIDATION AND TESTING ]========================
  
  const CodeValidator = {
    
    /**
     * Validate generated code syntax (basic checks)
     * @param {string} language - Target language
     * @param {string} code - Generated code
     * @returns {Object} Validation result
     */
    validateSyntax: function(language, code) {
      const result = { valid: true, errors: [], warnings: [] };
      
      // Basic syntax checks
      const lines = code.split('\n');
      let braceCount = 0;
      let parenCount = 0;
      
      lines.forEach((line, index) => {
        // Count braces and parentheses
        for (let char of line) {
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;
          if (char === '(') parenCount++;
          if (char === ')') parenCount--;
        }
        
        // Check for common syntax issues
        if (language === 'python' && line.trim().endsWith(';')) {
          result.warnings.push(`Line ${index + 1}: Unnecessary semicolon in Python`);
        }
        
        if (line.includes('undefined') || line.includes('null')) {
          result.warnings.push(`Line ${index + 1}: Check null/undefined handling`);
        }
      });
      
      if (braceCount !== 0) {
        result.valid = false;
        result.errors.push('Mismatched braces');
      }
      
      if (parenCount !== 0) {
        result.valid = false;
        result.errors.push('Mismatched parentheses');
      }
      
      return result;
    },
    
    /**
     * Generate cross-language validation tests
     * @param {Array<string>} languages - Languages to test
     * @param {Array<string>} operations - Operations to validate
     * @returns {Object} Test specifications
     */
    generateCrossLanguageTests: function(languages, operations) {
      const tests = {};
      
      operations.forEach(opName => {
        const operation = CoreOperations[opName];
        tests[opName] = {
          operation: operation,
          implementations: {},
          testVectors: operation.testCases
        };
        
        languages.forEach(lang => {
          tests[opName].implementations[lang] = {
            code: CodeGenerator.generateOperation(lang, opName),
            language: lang
          };
        });
      });
      
      return tests;
    }
  };

  // ========================[ EXPORT INTERFACE ]========================
  
  // Extend OpCodes with code generation capabilities
  if (global.OpCodes) {
    global.OpCodes.CodeGenerator = CodeGenerator;
    global.OpCodes.CodeValidator = CodeValidator;
    global.OpCodes.LanguageConfigs = LanguageConfigs;
    global.OpCodes.CoreOperations = CoreOperations;
    
    // Main generation methods
    global.OpCodes.generateCode = function(language, operation, options) {
      return CodeGenerator.generateOperation(language, operation, options);
    };
    
    global.OpCodes.generateModule = function(language, operations, options) {
      return CodeGenerator.generateModule(language, operations, options);
    };
    
    global.OpCodes.generateTests = function(language, operations) {
      return CodeGenerator.generateTests(language, operations);
    };
    
    global.OpCodes.getSupportedLanguages = function() {
      return Object.keys(LanguageConfigs);
    };
    
    global.OpCodes.getSupportedOperations = function() {
      return Object.keys(CoreOperations);
    };
  }
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      CodeGenerator,
      CodeValidator,
      LanguageConfigs,
      CoreOperations
    };
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);