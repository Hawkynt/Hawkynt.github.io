/*
 * CryptoOpcodes - Cryptographic Operations
 * Generated from OpCodes.js for C++
 * Auto-generated code - do not modify manually
 * Educational implementation for learning purposes only
 */

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
 * Pack 4 bytes into a 32-bit word (big-endian)

Parameters:
  b0 (byte): Most significant byte
  b1 (byte): Second byte
  b2 (byte): Third byte
  b3 (byte): Least significant byte

Returns: int32

Educational implementation - review before production use
 */
uint32_t pack32be(uint8_t b0, uint8_t b1, uint8_t b2, uint8_t b3) {
    return (static_cast<uint32_t>(b0 & 0xFF) << 24) |
           (static_cast<uint32_t>(b1 & 0xFF) << 16) |
           (static_cast<uint32_t>(b2 & 0xFF) << 8) |
           static_cast<uint32_t>(b3 & 0xFF);
}

/**
 * XOR two byte arrays

Parameters:
  arr1 (array): First byte array
  arr2 (array): Second byte array

Returns: array

Educational implementation - review before production use
 */
std::vector<uint8_t> xorarrays(std::vector<uint8_t> arr1, std::vector<uint8_t> arr2) {
    size_t min_len = std::min(arr1.size(), arr2.size());
    std::vector<uint8_t> result(min_len);
    for (size_t i = 0; i < min_len; ++i) {
        result[i] = (arr1[i] ^ arr2[i]) & 0xFF;
    }
    return result;
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

/**
 * Galois Field GF(2^8) multiplication (for AES and other ciphers)

Parameters:
  a (byte): First operand (0-255)
  b (byte): Second operand (0-255)

Returns: byte

Educational implementation - review before production use
 */
uint8_t gf256mul(uint8_t a, uint8_t b) {
    // GF(2^8) multiplication implementation needed
    throw new Error("Not implemented");
}