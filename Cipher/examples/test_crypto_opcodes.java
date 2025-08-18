/*
 * Test suite for generated cryptographic operations
 * Validates correctness against known test vectors
 */

import org.junit.Test;
import static org.junit.Assert.*;

public class TestCryptoOpcodes {

    @Test
    public void testRotL32() {
        // Rotate left (circular left shift) for 32-bit values
        // Basic rotation
        assertEquals(0x23456781, CryptoOpcodes.RotL32(0x12345678, 0x04));
        // MSB rotation
        assertEquals(0x01, CryptoOpcodes.RotL32(0x80000000, 0x01));
        // Maximum rotation
        assertEquals(0x80000000, CryptoOpcodes.RotL32(0x01, 0x1F));
    }

    @Test
    public void testPack32BE() {
        // Pack 4 bytes into a 32-bit word (big-endian)
        // Standard packing
        assertEquals(0x12345678, CryptoOpcodes.Pack32BE(0x12, 0x34, 0x56, 0x78));
        // All ones
        assertEquals(0xFFFFFFFF, CryptoOpcodes.Pack32BE(0xFF, 0xFF, 0xFF, 0xFF));
        // Single bit
        assertEquals(0x01, CryptoOpcodes.Pack32BE(0x00, 0x00, 0x00, 0x01));
    }

    @Test
    public void testXorArrays() {
        // XOR two byte arrays
        // Basic XOR
        assertArrayEquals({{0xFF, 0xFF, 0xFF}}, CryptoOpcodes.XorArrays({{0x00, 0xFF, 0xAA}}, {{0xFF, 0x00, 0x55}}));
        // Different lengths
        assertArrayEquals({{0x44, 0x4C}}, CryptoOpcodes.XorArrays({{0x12, 0x34}}, {{0x56, 0x78, 0x9A}}));
    }
}