/**
 * Improved Universal Metadata Template for Cipher Algorithms
 * Compatible with existing CipherMetadata.createMetadata() system
 * (c)2006-2025 Hawkynt
 */

const ImprovedMetadataTemplate = {
    // Basic algorithm information
    name: "Algorithm Name",
    description: "Clear, concise description (max 3 sentences). Explain what the algorithm does and its primary use case.",
    
    // Historical and geographical context
    year: 2005, // Year of first publication/appearance, or null if unknown
    country: "US", // ISO 3166-1 alpha-2 country code where developed, or "International"
    
    // Technical categorization
    category: "block", // One of: block, stream, hash, classical, encoding, compression, asymmetric, special, mac, kdf, mode, padding, ecc, checksum
    
    // Technical specifications
    keySize: "128, 192, 256 bits", // Supported key sizes
    blockSize: "128 bits", // Block size for block ciphers, or "Variable" for others
    cryptoFamily: "Block cipher", // e.g., "Block cipher", "Stream cipher", "Hash function"
    cryptoType: "Symmetric", // "Symmetric", "Asymmetric", or "N/A"
    
    // Security assessment
    security: "High - widely used, no known practical attacks", // Brief security status
    
    // Documentation links (external resources explaining the algorithm)
    documentation: [
        {
            text: "Wikipedia Article",
            uri: "https://en.wikipedia.org/wiki/Algorithm_Name"
        },
        {
            text: "Original Paper",
            uri: "https://example.com/original-paper.pdf"
        },
        {
            text: "NIST Standard",
            uri: "https://nvlpubs.nist.gov/nistpubs/StandardDocument.pdf"
        }
    ],
    
    // Reference implementations (actual code repositories)
    references: [
        {
            text: "Author's C++ Implementation",
            uri: "https://github.com/author/algorithm-cpp/blob/main/algorithm.cpp"
        },
        {
            text: "OpenSSL Implementation",
            uri: "https://github.com/openssl/openssl/blob/master/crypto/algorithm/"
        },
        {
            text: "RFC Reference",
            uri: "https://tools.ietf.org/rfc/rfcXXXX.txt"
        }
    ],
    
    // Test vectors for validation
    testVectors: [
        // Block cipher test vector
        {
            description: "NIST test vector #1",
            source: "NIST SP 800-38A",
            key: "2b7e151628aed2a6abf7158809cf4f3c",
            plaintext: "6bc1bee22e409f96e93d7e117393172a",
            expected: "3ad77bb40d7a3660a89ecaf32466ef97"
        },
        // Hash function test vector  
        {
            description: "Empty string hash",
            source: "RFC XXXX",
            input: "",
            expected: "e3b0c44298fc1c149afbf4c8996fb924"
        },
        // Variable output hash
        {
            description: "SHAKE128 test vector",
            source: "NIST SP 800-185", 
            input: "00010203",
            outputLength: 32,
            expected: "46b9dd2b0ba88d13233b3feb743eeb24"
        },
        // Mode of operation test
        {
            description: "CBC mode with IV",
            source: "NIST SP 800-38A",
            key: "2b7e151628aed2a6abf7158809cf4f3c",
            iv: "000102030405060708090a0b0c0d0e0f", 
            plaintext: "6bc1bee22e409f96e93d7e117393172a",
            expected: "7649abac8119b246cee98e9b12e9197d"
        }
    ],
    
    // Performance characteristics (optional)
    performance: {
        throughput: "~500 MB/s on modern CPU", // Approximate performance
        memoryUsage: "Minimal - stateless operation",
        parallelizable: true // Whether algorithm can be parallelized
    },
    
    // Known vulnerabilities or limitations (optional)
    vulnerabilities: [
        {
            type: "Timing attack",
            description: "Implementation may be vulnerable to timing attacks",
            mitigation: "Use constant-time implementation"
        }
    ],
    
    // Usage recommendations (optional)
    usage: {
        recommended: true, // Whether algorithm is recommended for new projects
        deprecated: false, // Whether algorithm is deprecated
        replacedBy: null, // Name of replacement algorithm if deprecated
        useCases: ["General purpose encryption", "TLS/SSL", "File encryption"]
    }
};

// Helper function to convert hex strings to byte arrays
function hexToBytes(hex) {
    if (!hex || hex.length % 2 !== 0) {
        throw new Error('Invalid hex string');
    }
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
}

// Helper function to convert byte arrays to hex strings
function bytesToHex(bytes) {
    return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Export the template
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ImprovedMetadataTemplate, hexToBytes, bytesToHex };
}

if (typeof window !== 'undefined') {
    window.ImprovedMetadataTemplate = ImprovedMetadataTemplate;
    window.hexToBytes = hexToBytes;
    window.bytesToHex = bytesToHex;
}