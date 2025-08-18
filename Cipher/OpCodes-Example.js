/*
 * OpCodes Usage Example
 * Demonstrates how to use the OpCodes library for cleaner cipher implementations
 */

// Load dependencies
if (typeof require !== 'undefined') {
  var OpCodes = require('./OpCodes.js');
}

console.log('=== OpCodes Usage Examples ===\n');

// ========================[ BEFORE: Messy bit operations ]========================
console.log('--- Before OpCodes (Traditional Approach) ---');

function traditionalBlowfishF(x, sboxes) {
  // Traditional messy bit manipulation
  const a = (x >>> 24) & 0xFF;
  const b = (x >>> 16) & 0xFF;
  const c = (x >>> 8) & 0xFF;
  const d = x & 0xFF;
  
  return (((sboxes[0][a] + sboxes[1][b]) & 0xFFFFFFFF) ^ sboxes[2][c]) + sboxes[3][d];
}

// ========================[ AFTER: Clean OpCodes approach ]========================
console.log('--- After OpCodes (Modern Approach) ---');

function modernBlowfishF(x, sboxes) {
  // Clean, readable bit manipulation using OpCodes
  const bytes = OpCodes.Unpack32BE(x);
  return (((sboxes[0][bytes[0]] + sboxes[1][bytes[1]]) & 0xFFFFFFFF) ^ sboxes[2][bytes[2]]) + sboxes[3][bytes[3]];
}

// ========================[ STRING PROCESSING EXAMPLES ]========================
console.log('--- String Processing Examples ---');

// Convert plaintext to words for block cipher processing
const plaintext = "Hello World!1234"; // 16 bytes = 4 words
console.log('Original text:', plaintext);

const words = OpCodes.StringToWords32BE(plaintext);
console.log('As 32-bit words:', words.map(w => '0x' + w.toString(16).padStart(8, '0')));

const recovered = OpCodes.Words32BEToString(words);
console.log('Recovered text:', recovered);

// ========================[ ROTATION EXAMPLES ]========================
console.log('\n--- Rotation Examples (useful for SHA, ChaCha20, etc.) ---');

let value = 0x12345678;
console.log('Original value: 0x' + value.toString(16));

// Rotate left by 8 positions
value = OpCodes.RotL32(value, 8);
console.log('After RotL32(8): 0x' + value.toString(16));

// Rotate right by 8 positions (should restore original)
value = OpCodes.RotR32(value, 8);
console.log('After RotR32(8): 0x' + value.toString(16));

// ========================[ GF(2^8) MULTIPLICATION (AES) ]========================
console.log('\n--- GF(2^8) Multiplication (AES MixColumns) ---');

// AES MixColumns example
const state = [0x63, 0x7c, 0x77, 0x7b]; // Sample state column
const mixedColumn = [
  OpCodes.GF256Mul(state[0], 0x02) ^ OpCodes.GF256Mul(state[1], 0x03) ^ state[2] ^ state[3],
  state[0] ^ OpCodes.GF256Mul(state[1], 0x02) ^ OpCodes.GF256Mul(state[2], 0x03) ^ state[3],
  state[0] ^ state[1] ^ OpCodes.GF256Mul(state[2], 0x02) ^ OpCodes.GF256Mul(state[3], 0x03),
  OpCodes.GF256Mul(state[0], 0x03) ^ state[1] ^ state[2] ^ OpCodes.GF256Mul(state[3], 0x02)
];

console.log('Original state:', state.map(b => '0x' + b.toString(16).padStart(2, '0')));
console.log('Mixed column:  ', mixedColumn.map(b => '0x' + b.toString(16).padStart(2, '0')));

// ========================[ HEX DEBUGGING ]========================
console.log('\n--- Hex Debugging (great for cipher development) ---');

const testData = "Secret message";
const hexData = OpCodes.StringToHex(testData);
console.log('Text:', testData);
console.log('Hex: ', hexData);
console.log('Back:', OpCodes.HexToString(hexData));

// ========================[ ARRAY XOR (useful for key streams) ]========================
console.log('\n--- Array XOR Operations ---');

const plainBytes = OpCodes.StringToBytes("HELLO");
const keyBytes = [0x01, 0x02, 0x03, 0x04, 0x05];
const encrypted = OpCodes.XorArrays(plainBytes, keyBytes);
const decrypted = OpCodes.XorArrays(encrypted, keyBytes);

console.log('Plain:    ', plainBytes);
console.log('Key:      ', keyBytes);
console.log('Encrypted:', encrypted);
console.log('Decrypted:', decrypted);
console.log('Verified: ', OpCodes.BytesToString(decrypted));

console.log('\n=== Summary ===');
console.log('✓ OpCodes provides clean, reusable cryptographic operations');
console.log('✓ Reduces code duplication across cipher implementations');
console.log('✓ Improves readability and maintainability'); 
console.log('✓ Includes performance-optimized operations');
console.log('✓ Supports both browser and Node.js environments');
console.log('✓ Ready for use in all cipher implementations!');