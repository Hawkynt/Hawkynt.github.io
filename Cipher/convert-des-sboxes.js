#!/usr/bin/env node
/*
 * Convert DES S-boxes to Hex Format
 * (c)2025 Hawkynt
 * 
 * Converts the DES S-box definitions from array format to hex strings
 * for use with OpCodes hex utilities.
 */

// Load OpCodes.js
if (typeof OpCodes === 'undefined') {
  try {
    require('./OpCodes.js');
  } catch (e) {
    console.error('Failed to load OpCodes.js:', e.message);
    process.exit(1);
  }
}

// Original DES S-boxes from the file
const originalSboxes = [
  // S1
  [
    [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7],
    [0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8],
    [4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0],
    [15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13]
  ],
  // S2
  [
    [15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10],
    [3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5],
    [0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15],
    [13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9]
  ],
  // S3
  [
    [10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8],
    [13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1],
    [13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7],
    [1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12]
  ],
  // S4
  [
    [7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15],
    [13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9],
    [10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4],
    [3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14]
  ],
  // S5
  [
    [2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9],
    [14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6],
    [4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14],
    [11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3]
  ],
  // S6
  [
    [12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11],
    [10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8],
    [9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6],
    [4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13]
  ],
  // S7
  [
    [4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1],
    [13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6],
    [1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2],
    [6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12]
  ],
  // S8
  [
    [13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7],
    [1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2],
    [7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8],
    [2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11]
  ]
];

function convertSboxToHex() {
  console.log('Converting DES S-boxes to hex format...\n');
  
  const hexSboxes = [];
  
  for (let sboxIndex = 0; sboxIndex < originalSboxes.length; sboxIndex++) {
    const sbox = originalSboxes[sboxIndex];
    
    // Flatten the 4x16 matrix into a linear array
    const flatSbox = [];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 16; col++) {
        flatSbox.push(sbox[row][col]);
      }
    }
    
    // Convert to hex string
    const hexString = OpCodes.BytesToHex8(flatSbox);
    
    // Format for readability (16 hex pairs per line)
    let formattedHex = '';
    for (let i = 0; i < hexString.length; i += 32) {
      if (i > 0) formattedHex += '\n        ';
      formattedHex += hexString.substr(i, 32);
    }
    
    hexSboxes.push(formattedHex);
    
    console.log(`S${sboxIndex + 1} hex:`);
    console.log(`        "${formattedHex}"`);
    console.log();
  }
  
  // Generate the new JavaScript code
  console.log('JavaScript code with hex S-boxes:');
  console.log('    // DES S-boxes using OpCodes hex utilities');
  console.log('    SBOX_HEX: [');
  
  for (let i = 0; i < hexSboxes.length; i++) {
    console.log(`      // S${i + 1}`);
    console.log(`      "${hexSboxes[i]}"${i < hexSboxes.length - 1 ? ',' : ''}`);
  }
  
  console.log('    ],');
  console.log();
  console.log('    // Convert hex S-boxes to runtime format');
  console.log('    SBOX: null, // Will be initialized from SBOX_HEX');
  console.log();
  console.log('    // Initialize S-boxes from hex data');
  console.log('    initSBoxes: function() {');
  console.log('      if (this.SBOX) return; // Already initialized');
  console.log('      this.SBOX = [];');
  console.log('      for (let i = 0; i < this.SBOX_HEX.length; i++) {');
  console.log('        const flatSbox = OpCodes.Hex8ToBytes(this.SBOX_HEX[i]);');
  console.log('        const sbox = [];');
  console.log('        for (let row = 0; row < 4; row++) {');
  console.log('          sbox[row] = [];');
  console.log('          for (let col = 0; col < 16; col++) {');
  console.log('            sbox[row][col] = flatSbox[row * 16 + col];');
  console.log('          }');
  console.log('        }');
  console.log('        this.SBOX.push(sbox);');
  console.log('      }');
  console.log('    },');
  
  // Verify conversion
  console.log('\nVerifying conversion...');
  for (let sboxIndex = 0; sboxIndex < originalSboxes.length; sboxIndex++) {
    const hexString = hexSboxes[sboxIndex].replace(/\s+/g, '');
    const flatSbox = OpCodes.Hex8ToBytes(hexString);
    
    // Rebuild the 4x16 matrix
    const rebuiltSbox = [];
    for (let row = 0; row < 4; row++) {
      rebuiltSbox[row] = [];
      for (let col = 0; col < 16; col++) {
        rebuiltSbox[row][col] = flatSbox[row * 16 + col];
      }
    }
    
    // Compare with original
    let matches = true;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 16; col++) {
        if (rebuiltSbox[row][col] !== originalSboxes[sboxIndex][row][col]) {
          matches = false;
          break;
        }
      }
      if (!matches) break;
    }
    
    console.log(`S${sboxIndex + 1}: ${matches ? '✓' : '✗'} ${matches ? 'Conversion verified' : 'Conversion failed'}`);
  }
}

if (require.main === module) {
  convertSboxToHex();
}