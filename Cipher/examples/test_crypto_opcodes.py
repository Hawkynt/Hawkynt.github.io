/*
 * Test suite for generated cryptographic operations
 * Validates correctness against known test vectors
 */

import unittest
from crypto_opcodes import *

class TestCryptoOpcodes(unittest.TestCase):

    def test_rotl32(self):
        """Test Rotate left (circular left shift) for 32-bit values"""
        # Basic rotation
        result = RotL32(0x12345678, 0x04)
        self.assertEqual(result, 0x23456781)
        # MSB rotation
        result = RotL32(0x80000000, 0x01)
        self.assertEqual(result, 0x01)
        # Maximum rotation
        result = RotL32(0x01, 0x1F)
        self.assertEqual(result, 0x80000000)

    def test_pack32be(self):
        """Test Pack 4 bytes into a 32-bit word (big-endian)"""
        # Standard packing
        result = Pack32BE(0x12, 0x34, 0x56, 0x78)
        self.assertEqual(result, 0x12345678)
        # All ones
        result = Pack32BE(0xFF, 0xFF, 0xFF, 0xFF)
        self.assertEqual(result, 0xFFFFFFFF)
        # Single bit
        result = Pack32BE(0x00, 0x00, 0x00, 0x01)
        self.assertEqual(result, 0x01)

    def test_xorarrays(self):
        """Test XOR two byte arrays"""
        # Basic XOR
        result = XorArrays([0x00, 0xFF, 0xAA], [0xFF, 0x00, 0x55])
        self.assertEqual(result, [0xFF, 0xFF, 0xFF])
        # Different lengths
        result = XorArrays([0x12, 0x34], [0x56, 0x78, 0x9A])
        self.assertEqual(result, [0x44, 0x4C])

if __name__ == "__main__":
    unittest.main()