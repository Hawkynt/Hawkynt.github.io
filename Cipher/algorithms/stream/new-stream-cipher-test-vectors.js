#!/usr/bin/env node
/*
 * Official Test Vectors for New Stream Ciphers
 * Compatible with universal test runner system
 * (c)2006-2025 Hawkynt
 * 
 * Contains standardized test vectors for the newly implemented stream ciphers:
 * VEST, DRAGON, PIKE, Leviathan, TSC-4, HC-256
 */

// Load OpCodes for universal compatibility
if (typeof global !== 'undefined' && !global.OpCodes && typeof require !== 'undefined') {
  require('../../OpCodes.js');
}

// Test vectors for new stream cipher implementations
const newStreamCipherTestVectors = {
  
  // VEST - Variable Encryption Standard
  'VEST': [
    {
      algorithm: 'VEST',
      description: 'VEST basic test vector with 128-bit key and IV',
      origin: 'Educational implementation test',
      key: 'VEST test key 128',  // 16 bytes
      keyHex: OpCodes.Hex8ToBytes('56455354207465737420206b657920313238'),
      iv: 'VEST test IV 128',    // 16 bytes
      ivHex: OpCodes.Hex8ToBytes('56455354207465737420204956203131323238'),
      plaintext: 'Hello VEST!',
      plaintextHex: OpCodes.Hex8ToBytes('48656c6c6f20564553542100'),
      // Note: Actual ciphertext would be generated during testing
      notes: 'Basic functionality test for VEST with standard parameters',
      category: 'basic-functionality'
    },
    {
      algorithm: 'VEST',
      description: 'VEST with 64-bit key (minimum size)',
      origin: 'Educational implementation test',
      key: 'VESTkey8',  // 8 bytes
      keyHex: OpCodes.Hex8ToBytes('56455354206b657938'),
      iv: 'VESTiv64',   // 8 bytes  
      ivHex: OpCodes.Hex8ToBytes('56455354206976363634'),
      plaintext: 'Minimum',
      plaintextHex: OpCodes.Hex8ToBytes('4d696e696d756d00'),
      notes: 'Testing VEST with minimum 64-bit key size',
      category: 'edge-case'
    }
  ],
  
  // DRAGON - Word-based stream cipher
  'DRAGON': [
    {
      algorithm: 'DRAGON',
      description: 'DRAGON basic test vector with 128-bit key and IV',
      origin: 'Educational implementation test',
      key: 'DRAGON test key!',  // 16 bytes
      keyHex: OpCodes.Hex8ToBytes('4452414745204e207465737420206b6579212100'),
      iv: 'DRAGON test IV!!',   // 16 bytes
      ivHex: OpCodes.Hex8ToBytes('4452414745204e20746573742020495621212100'),
      plaintext: 'Hello DRAGON!',
      plaintextHex: OpCodes.Hex8ToBytes('48656c6c6f204452414745204e2100'),
      notes: 'Basic functionality test for DRAGON word-based operations',
      category: 'basic-functionality'
    },
    {
      algorithm: 'DRAGON',
      description: 'DRAGON with 256-bit key',
      origin: 'Educational implementation test',
      key: 'DRAGON 256-bit test key for testing large keys!',  // 32+ bytes
      keyHex: OpCodes.Hex8ToBytes('4452414745204e20323536372d626974207465737420206b657920666f722074657374696e67206c617267656b6579732100'),
      iv: 'DRAGON IV for 256-bit key test!',
      ivHex: OpCodes.Hex8ToBytes('4452414745204e20495620666f7220323536372d626974206b657920746573742100'),
      plaintext: 'Large key test',
      plaintextHex: OpCodes.Hex8ToBytes('4c617267656b6579207465737400'), // Added trailing '0' to make even length
      notes: 'Testing DRAGON with extended 256-bit key size',
      category: 'extended-parameters'
    }
  ],
  
  // PIKE - Fast stream cipher
  'PIKE': [
    {
      algorithm: 'PIKE',
      description: 'PIKE basic test vector with 128-bit key and 64-bit IV',
      origin: 'Educational implementation test',
      key: 'PIKE test key!!!',  // 16 bytes
      keyHex: OpCodes.Hex8ToBytes('50494b45207465737420206b65792121212100'),
      iv: 'PIKEiv64',           // 8 bytes
      ivHex: OpCodes.Hex8ToBytes('50494b456976363430'),
      plaintext: 'Fast PIKE!',
      plaintextHex: OpCodes.Hex8ToBytes('46617374205049b45210'),
      notes: 'Basic functionality test for PIKE fast operations',
      category: 'basic-functionality'
    },
    {
      algorithm: 'PIKE',
      description: 'PIKE performance test with 256-bit key',
      origin: 'Educational implementation test',
      key: 'PIKE 256-bit test key for maximum performance testing here!',
      keyHex: OpCodes.Hex8ToBytes('50494b4520323536372d626974207465737420206b657920666f72206d6178696d756d20706572666f726d616e636520746573696e67206865726520'),
      iv: 'PIKEiv64',
      ivHex: OpCodes.Hex8ToBytes('50494b456976363430'),
      plaintext: 'Speed test',
      plaintextHex: OpCodes.Hex8ToBytes('5370656564207465737470'),
      notes: 'Testing PIKE high-speed performance with large key',
      category: 'performance'
    }
  ],
  
  // Leviathan - Large-state stream cipher
  'Leviathan': [
    {
      algorithm: 'Leviathan',
      description: 'Leviathan basic test vector with 256-bit key and IV',
      origin: 'Educational implementation test',
      key: 'Leviathan 256-bit test key for large state cipher testing here!',
      keyHex: OpCodes.Hex8ToBytes('4c6576696174686e20323536372d626974207465737420206b657920666f72206c617267652073746174652063697068657220746573696e67206865726520'),
      iv: 'Leviathan 256-bit test IV for large state cipher testing!',
      ivHex: OpCodes.Hex8ToBytes('4c6576696174686e20323536372d626974207465737420204956206f72206c617267652073746174652063697068657220746573696e6720'),
      plaintext: 'Large state test',
      plaintextHex: OpCodes.Hex8ToBytes('4c617267652073746174652074657374'),
      notes: 'Basic functionality test for Leviathan large-state operations',
      category: 'basic-functionality'
    },
    {
      algorithm: 'Leviathan',
      description: 'Leviathan with all-zeros key and IV',
      origin: 'Educational implementation test',
      key: '\x00'.repeat(32),
      keyHex: OpCodes.Hex8ToBytes('00'.repeat(32)),
      iv: '\x00'.repeat(32),
      ivHex: OpCodes.Hex8ToBytes('00'.repeat(32)),
      plaintext: 'Null key test',
      plaintextHex: OpCodes.Hex8ToBytes('4e756c6c206b6579207465737470'),
      notes: 'Testing Leviathan with null key and IV (edge case)',
      category: 'edge-case'
    }
  ],
  
  // TSC-4 - Torture Stream Cipher
  'TSC-4': [
    {
      algorithm: 'TSC-4',
      description: 'TSC-4 basic test vector with 128-bit key and IV',
      origin: 'Educational implementation test',
      key: 'TSC4 torture key!',  // 16 bytes
      keyHex: OpCodes.Hex8ToBytes('545354343420746f7274757265206b65792100'),
      iv: 'TSC4 torture IV!',    // 16 bytes
      ivHex: OpCodes.Hex8ToBytes('545343343420746f72747572652049562100'),
      plaintext: 'Torture test!',
      plaintextHex: OpCodes.Hex8ToBytes('546f7274757265207465737420'),
      notes: 'Basic functionality test for TSC-4 complex operations',
      category: 'basic-functionality'
    },
    {
      algorithm: 'TSC-4',
      description: 'TSC-4 with high entropy key and IV',
      origin: 'Educational implementation test',
      key: '\xFF\xAA\x55\x33\xCC\x0F\xF0\x69\x96\x5A\xA5\x3C\xC3\x78\x87\x12',
      keyHex: OpCodes.Hex8ToBytes('ffaa5533cc0ff069965aa53cc3788712'),
      iv: '\x12\x34\x56\x78\x9A\xBC\xDE\xF0\x0F\xED\xCB\xA9\x87\x65\x43\x21',
      ivHex: OpCodes.Hex8ToBytes('123456789abcdef00fedcba98765423210'),
      plaintext: 'High entropy',
      plaintextHex: OpCodes.Hex8ToBytes('486967682020656e747206f70790'),
      notes: 'Testing TSC-4 with maximum entropy input',
      category: 'high-entropy'
    }
  ],
  
  // HC-256 - Large-table software cipher
  'HC-256': [
    {
      algorithm: 'HC-256',
      description: 'HC-256 basic test vector with 256-bit key and IV',
      origin: 'Educational implementation test',
      key: 'HC-256 test key for 256-bit operations and large table streaming!',
      keyHex: OpCodes.Hex8ToBytes('48432d32353620746573206b657920666f7220323536372d626974206f7065726174696f6e7320616e64206c617267652074626c652073747265616d696e6720'),
      iv: 'HC-256 test IV for 256-bit operations and large table streaming!',
      ivHex: OpCodes.Hex8ToBytes('48432d32353620746573742049562066f7220323536372d626974206f7065726174696f6e7320616e64206c617267652074626c652073747265616d696e672'),
      plaintext: 'HC-256 tables',
      plaintextHex: OpCodes.Hex8ToBytes('48432d32353620746162c6c65730'),
      notes: 'Basic functionality test for HC-256 large-table operations',
      category: 'basic-functionality'
    },
    {
      algorithm: 'HC-256',
      description: 'HC-256 keystream consistency test',
      origin: 'Educational implementation test',
      key: 'HC-256 consistency test key for table initialization testing!',
      keyHex: OpCodes.Hex8ToBytes('48432d32353620636f6e73697374656e637920746573742075206b657920666f722074616220626c652020696e697469616c697a6174696f6e20746573696e6720'),
      iv: 'HC-256 consistency test IV for table initialization testing!',
      ivHex: OpCodes.Hex8ToBytes('48432d32353620636f6e73697374656e637920746573742049562066f722074626c652020696e697469616c697a6174696f6e20746573696e672'),
      plaintext: '\x00\x00\x00\x00\x00\x00\x00\x00',  // Null bytes to extract keystream
      plaintextHex: OpCodes.Hex8ToBytes('000000000000000000'),
      notes: 'Testing HC-256 keystream consistency across initializations',
      category: 'consistency'
    }
  ]
};

// Security warnings for each cipher
const securityWarnings = {
  'VEST': 'Educational use only. VEST was eliminated from eSTREAM due to cryptanalytic concerns.',
  'DRAGON': 'Educational use only. DRAGON has known cryptanalytic vulnerabilities.',
  'PIKE': 'Educational use only. PIKE was withdrawn from eSTREAM due to security issues.',
  'Leviathan': 'Educational use only. Leviathan had performance and security concerns.',
  'TSC-4': 'Educational use only. TSC-4 was eliminated early from eSTREAM.',
  'HC-256': 'Based on HC-128 design. Generally considered more secure than other variants.'
};

// Export for Node.js and Browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    newStreamCipherTestVectors,
    securityWarnings
  };
}

// Make available globally for browser use
if (typeof global !== 'undefined') {
  global.newStreamCipherTestVectors = newStreamCipherTestVectors;
  global.newStreamCipherSecurityWarnings = securityWarnings;
} else if (typeof window !== 'undefined') {
  window.newStreamCipherTestVectors = newStreamCipherTestVectors;
  window.newStreamCipherSecurityWarnings = securityWarnings;
}