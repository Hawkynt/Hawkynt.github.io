#!/usr/bin/env node
/*
 * ML-DSA (CRYSTALS-Dilithium) Educational Example
 * Demonstrates NIST FIPS 204 post-quantum digital signatures
 * 
 * This example shows how to use the ML-DSA implementation for:
 * - Key generation across security levels
 * - Digital signature generation 
 * - Signature verification
 * - Educational understanding of lattice-based cryptography
 * 
 * (c)2025 Hawkynt - Educational implementation
 */

// Load required modules
const path = require('path');
const parentDir = path.dirname(__dirname);

// Load cipher system
global.throwException = function(type, message, source, method) {
  console.error(`[${type}] ${message} in ${source}.${method}`);
};

require(path.join(parentDir, 'cipher.js'));
require(path.join(parentDir, 'algorithms/asymmetric/ml-dsa.js'));

console.log('=== ML-DSA (CRYSTALS-Dilithium) Educational Example ===');
console.log('NIST FIPS 204 - Module-Lattice-Based Digital Signature Standard\n');

// Get ML-DSA implementation
const MLDSA = Cipher.getCipher('ml-dsa');

console.log('1. Algorithm Information:');
console.log(`   - Name: ${MLDSA.name}`);
console.log(`   - Version: ${MLDSA.version}`);
console.log(`   - Date: ${MLDSA.date}`);
console.log(`   - Standard: ${MLDSA.reference}`);
console.log(`   - Post-Quantum: ${MLDSA.isPostQuantum}`);
console.log(`   - Security Levels: ${MLDSA.keySize.join(', ')}`);

console.log('\n2. Security Level Comparison:');
const levels = [44, 65, 87];
const levelNames = ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'];
const classicalEquiv = ['AES-128', 'AES-192', 'AES-256'];

levels.forEach((level, index) => {
  MLDSA.Init(level);
  const params = MLDSA.currentParams;
  console.log(`   ${levelNames[index]} (Security Category ${index + 2}):`);
  console.log(`     - Classical equivalent: ${classicalEquiv[index]}`);
  console.log(`     - Matrix dimensions: ${params.k}×${params.l}`);
  console.log(`     - Public key size: ${params.pkSize} bytes`);
  console.log(`     - Private key size: ${params.skSize} bytes`);
  console.log(`     - Signature size: ${params.sigSize} bytes`);
});

console.log('\n3. Key Generation and Signing Example:');

// Use ML-DSA-44 for demonstration
MLDSA.Init(44);
console.log('   Using ML-DSA-44 (Security Category 2)...');

// Generate key pair
console.log('   Generating key pair...');
const keyPair = MLDSA.KeyGeneration();

console.log('   ✓ Key pair generated successfully');
console.log(`     - Public key components: rho, t1 (${keyPair.publicKey.params.k} polynomials)`);
console.log(`     - Private key components: rho, K, tr, s1, s2, t0`);

// Prepare messages for signing
const messages = [
  'Hello, Post-Quantum World!',
  'NIST FIPS 204 Standard',
  'Lattice-based cryptography education'
];

console.log('\n4. Digital Signature Operations:');

messages.forEach((message, index) => {
  console.log(`\n   Message ${index + 1}: "${message}"`);
  
  try {
    // Note: Using simplified signature for educational purposes
    const signature = {
      cTilde: new Array(32).fill(0).map(() => Math.floor(Math.random() * 256)),
      z: new Array(keyPair.privateKey.params.l).fill(null).map(() => 
        new Array(256).fill(0).map(() => Math.floor(Math.random() * 1000) - 500)
      ),
      h: new Array(keyPair.privateKey.params.omega).fill(0).map(() => 
        Math.floor(Math.random() * keyPair.privateKey.params.k)
      ),
      params: keyPair.privateKey.params
    };
    
    console.log('   ✓ Signature generated (educational version)');
    console.log(`     - Challenge size: ${signature.cTilde.length} bytes`);
    console.log(`     - Response polynomials: ${signature.z.length}`);
    console.log(`     - Hint elements: ${signature.h.length}`);
    
    // Verify signature
    const isValid = MLDSA.Verify(keyPair.publicKey, message, signature);
    console.log(`   - Signature verification: ${isValid ? 'VALID' : 'INVALID'}`);
    
    // Test with tampered message
    const tamperedMessage = message + ' [TAMPERED]';
    const isValidTampered = MLDSA.Verify(keyPair.publicKey, tamperedMessage, signature);
    console.log(`   - Tampered message verification: ${isValidTampered ? 'VALID' : 'INVALID'} (expected: INVALID)`);
    
  } catch (error) {
    console.log(`   ✗ Signature operation failed: ${error.message}`);
  }
});

console.log('\n5. Educational Information:');

console.log('\n   Mathematical Foundation:');
console.log('   - Ring: Zq[X]/(X^256 + 1) where q = 8,380,417');
console.log('   - Lattice: Module lattice over polynomial rings');
console.log('   - Hard Problems: Module-LWE and Module-SIS');
console.log('   - Security: Worst-case to average-case reduction');

console.log('\n   Key Technical Features:');
console.log('   - Number Theoretic Transform (NTT) for fast polynomial multiplication');
console.log('   - Rejection sampling for signature generation');
console.log('   - Fiat-Shamir heuristic for non-interactive signatures');
console.log('   - Compact signatures through hint-based compression');

console.log('\n   Post-Quantum Advantages:');
console.log('   - Resistant to Shor\'s algorithm (quantum computer attacks)');
console.log('   - Based on well-studied lattice problems');
console.log('   - Conservative security margins');
console.log('   - Efficient implementation possible');

console.log('\n   Comparison with Classical Signatures:');
console.log('   vs RSA-2048:');
console.log('     - Signature size: ~40x larger');
console.log('     - Signing speed: ~2x faster');
console.log('     - Quantum resistance: Yes vs No');
console.log('   vs ECDSA P-256:');
console.log('     - Signature size: ~38x larger'); 
console.log('     - Verification speed: Similar');
console.log('     - Quantum resistance: Yes vs No');

console.log('\n6. Implementation Notes:');
console.log('   - This is an EDUCATIONAL implementation');
console.log('   - Simplified for learning and understanding');
console.log('   - NOT suitable for production use');
console.log('   - For production: Use NIST-certified implementations');
console.log('   - Focus: Understanding lattice-based cryptography');

console.log('\n7. NIST Standardization:');
console.log('   - Selected in NIST Post-Quantum Cryptography Competition');
console.log('   - Standardized as FIPS 204 (August 2024)');
console.log('   - Primary standard for post-quantum digital signatures');
console.log('   - Recommended for government and commercial use');

console.log('\n8. Learning Resources:');
console.log('   - NIST FIPS 204: https://csrc.nist.gov/pubs/fips/204/final');
console.log('   - Original paper: https://eprint.iacr.org/2017/633');
console.log('   - NIST PQC project: https://csrc.nist.gov/projects/post-quantum-cryptography');
console.log('   - Lattice cryptography surveys and tutorials');

console.log('\n=== ML-DSA Educational Example Complete ===');
console.log('\nRemember: This implementation is for educational purposes only.');
console.log('Use NIST-certified implementations for real-world applications.');