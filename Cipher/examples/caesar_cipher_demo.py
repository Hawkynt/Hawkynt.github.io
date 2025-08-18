#!/usr/bin/env python3
"""
Caesar Cipher Implementation using Generated OpCodes
Demonstrates practical usage of the generated cryptographic operations
"""

from typing import List, Tuple, Union
import struct

"""Convert string to byte array

Parameters:
  str (string): Input string

Returns: array

Educational implementation - review before production use"""
def stringtobytes(str: str) -> List[int]:
    return [ord(c) & 0xFF for c in str]

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
    print("=== OpCodes Operations Demonstration ===\n")
    
    # String conversion
    test_string = "Hello, World!"
    bytes_result = stringtobytes(test_string)
    print(f"StringToBytes('{test_string}') = {bytes_result}")
    print(f"As hex: {' '.join(f'{b:02X}' for b in bytes_result)}\n")
    
    # Caesar cipher demonstration
    plaintext = "The quick brown fox jumps over the lazy dog"
    encrypted = caesar_encrypt(plaintext, 3)
    decrypted = caesar_decrypt(encrypted, 3)
    
    print("=== Caesar Cipher Demonstration ===")
    print(f"Original:  {plaintext}")
    print(f"Encrypted: {encrypted}")
    print(f"Decrypted: {decrypted}")
    print(f"Match: {'✅' if plaintext == decrypted else '❌'}\n")

if __name__ == "__main__":
    demonstrate_operations()
