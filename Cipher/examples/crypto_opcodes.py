"""CryptoOpcodes - Cryptographic Operations
Generated from OpCodes.js for Python
Auto-generated code - do not modify manually
Educational implementation for learning purposes only"""

from typing import List, Tuple, Union
import struct

"""Rotate left (circular left shift) for 32-bit values

Parameters:
  value (int32): 32-bit value to rotate
  positions (byte): Number of positions to rotate (0-31)

Returns: int32

Educational implementation - review before production use"""
def rotl32(value: int, positions: int) -> int:
    # Ensure unsigned 32-bit arithmetic
    value = value & 0xFFFFFFFF
    positions = positions & 31
    return ((value << positions) | (value >> (32 - positions))) & 0xFFFFFFFF

"""Pack 4 bytes into a 32-bit word (big-endian)

Parameters:
  b0 (byte): Most significant byte
  b1 (byte): Second byte
  b2 (byte): Third byte
  b3 (byte): Least significant byte

Returns: int32

Educational implementation - review before production use"""
def pack32be(b0: int, b1: int, b2: int, b3: int) -> int:
    return ((b0 & 0xFF) << 24) | ((b1 & 0xFF) << 16) | ((b2 & 0xFF) << 8) | (b3 & 0xFF)

"""XOR two byte arrays

Parameters:
  arr1 (array): First byte array
  arr2 (array): Second byte array

Returns: array

Educational implementation - review before production use"""
def xorarrays(arr1: List[int], arr2: List[int]) -> List[int]:
    min_len = min(len(arr1), len(arr2))
    return [(arr1[i] ^ arr2[i]) & 0xFF for i in range(min_len)]

"""Convert string to byte array

Parameters:
  str (string): Input string

Returns: array

Educational implementation - review before production use"""
def stringtobytes(str: str) -> List[int]:
    return [ord(c) & 0xFF for c in str]

"""Galois Field GF(2^8) multiplication (for AES and other ciphers)

Parameters:
  a (byte): First operand (0-255)
  b (byte): Second operand (0-255)

Returns: byte

Educational implementation - review before production use"""
def gf256mul(a: int, b: int) -> int:
    result = 0
    a &= 0xFF
    b &= 0xFF
    for i in range(8):
        if b & 1:
            result ^= a
        high_bit = a & 0x80
        a = (a << 1) & 0xFF
        if high_bit:
            a ^= 0x1B  # AES irreducible polynomial
        b >>= 1
    return result & 0xFF