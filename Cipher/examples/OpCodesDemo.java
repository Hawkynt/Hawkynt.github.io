/*
 * OpCodes Java Example - Cryptographic Operations
 * Generated using OpCodes Multi-Language Framework
 */

import java.util.Arrays;
import java.util.List;
import java.util.ArrayList;

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
public static int pack32be(int b0, int b1, int b2, int b3) {
    return ((b0 & 0xFF) << 24) | ((b1 & 0xFF) << 16) | ((b2 & 0xFF) << 8) | (b3 & 0xFF);
}

/**
 * XOR two byte arrays

Parameters:
  arr1 (array): First byte array
  arr2 (array): Second byte array

Returns: array

Educational implementation - review before production use
 */
public static int[] xorarrays(int[] arr1, int[] arr2) {
    int minLen = Math.min(arr1.length, arr2.length);
    int[] result = new int[minLen];
    for (int i = 0; i < minLen; i++) {
        result[i] = (arr1[i] ^ arr2[i]) & 0xFF;
    }
    return result;
}

public class OpCodesDemo {
    
    public static void demonstrateOperations() {
        System.out.println("=== OpCodes Java Operations Demonstration ===\n");
        
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
        System.out.println("\n");
    }
    
    public static void main(String[] args) {
        demonstrateOperations();
    }
}
