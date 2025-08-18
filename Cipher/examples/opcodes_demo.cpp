/*
 * OpCodes C++ Example - Cryptographic Operations
 * Generated using OpCodes Multi-Language Framework
 */

#include <iostream>
#include <vector>
#include <string>
#include <iomanip>

#include <cstdint>
#include <vector>
#include <array>
#include <algorithm>

/**
 * Rotate left (circular left shift) for 32-bit values

Parameters:
  value (int32): 32-bit value to rotate
  positions (byte): Number of positions to rotate (0-31)

Returns: int32

Educational implementation - review before production use
 */
uint32_t rotl32(uint32_t value, uint8_t positions) {
    // Ensure unsigned 32-bit arithmetic
    value = static_cast<uint32_t>(value);
    positions &= 31;
    return (value << positions) | (value >> (32 - positions));
}

/**
 * Convert string to byte array

Parameters:
  str (string): Input string

Returns: array

Educational implementation - review before production use
 */
std::vector<uint8_t> stringtobytes(std::string str) {
    std::vector<uint8_t> result;
    for (char c : str) {
        result.push_back(static_cast<uint8_t>(c));
    }
    return result;
}

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
    std::cout << "Input:  \"" << testString << "\"" << std::endl;
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
