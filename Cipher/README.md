# 🔐 Cipher Collection

A comprehensive collection of classical and modern cryptographic algorithms implemented in JavaScript for educational and research purposes.

## 🚀 Features

- **Modern Dark UI** with blue-black gradient design
- **Responsive Layout** with CSS Grid and legacy browser fallbacks
- **Live Testing Suite** with hex display for binary data
- **Multiple Cipher Support** including both classical and modern algorithms
- **Cross-Browser Compatibility** from modern browsers down to IE5 and Lynx

## 🔧 Supported Ciphers

### Classical Ciphers
- **Caesar Cipher** - Simple shift cipher with configurable offset
- **Atbash Cipher** - Hebrew alphabet reversal cipher
- **ROT13/ROT5/ROT18/ROT47** - Various rotation ciphers
- **ROTx** - Configurable rotation cipher with custom keys
- **Mystery Cipher** - Custom substitution cipher

### Modern Ciphers
- **BASE64** - Standard encoding with RFC 4648 test vectors
- **Blowfish** - 64-bit block cipher with variable key length
- **TEA** - Tiny Encryption Algorithm (64-bit blocks, 128-bit keys)
- **Rijndael (AES)** - Advanced Encryption Standard
- **Anubis** - 128-bit block cipher from NESSIE project
- **Khazad** - 64-bit block cipher from NESSIE project

## 🎯 Usage

1. Open `index.html` in any web browser
2. Select a cipher from the dropdown menu
3. Enter your text and key (if required)
4. Click "Encrypt" or "Decrypt"
5. Switch to the "Unit Tests" tab to run comprehensive test suites

## 🧪 Testing

The built-in test suite includes:
- **Official test vectors** from RFCs and cryptographic standards
- **Hex display** for viewing binary cipher outputs
- **Real-time validation** comparing expected vs actual results
- **Cross-cipher compatibility** testing

### Running Tests
1. Click the "Unit Tests" tab
2. Click "Run All Tests"
3. View detailed results with input/output/expected values in both text and hex format

## 🔍 Technical Details

### Architecture
- **Modular Design** - Each cipher is implemented as a separate JavaScript object
- **Consistent API** - All ciphers follow the same interface pattern:
  - `Init()` - Initialize the cipher
  - `KeySetup(key)` - Set up encryption key, returns instance ID
  - `szEncryptBlock(id, plaintext)` - Encrypt data
  - `szDecryptBlock(id, ciphertext)` - Decrypt data
  - `ClearData(id)` - Clean up cipher instance

### Browser Compatibility
- **Modern Browsers** - Full CSS Grid, dark theme, responsive design
- **Legacy Browsers** - Graceful degradation to HTML tables and basic styling
- **Text Browsers** - Fully functional with Lynx and similar browsers

## 📁 File Structure

```
Cipher/
├── index.html          # Main cipher interface
├── cipher.js           # Core cipher framework
├── utils.js            # Utility functions
├── caesar.js           # Caesar cipher implementation
├── base64.js           # BASE64 encoding
├── rot.js              # ROT family ciphers
├── atbash.js           # Atbash cipher
├── blowfish.js         # Blowfish algorithm
├── tea.js              # Tiny Encryption Algorithm
├── anubis.js           # Anubis cipher
├── khazad.js           # Khazad cipher
├── rijndael.js         # AES/Rijndael
├── mystery.js          # Mystery substitution cipher
└── README.md           # This file
```

## 🛠️ Development

### Adding New Ciphers
1. Create a new `.js` file following the standard cipher interface
2. Add the cipher to the main `index.html` script includes
3. Register it with `Cipher.AddCipher(YourCipher)`
4. Add test vectors to the `testVectors` object

### Test Vector Generation
Use the browser console with the cipher page loaded:
```javascript
// Generate test vectors for your cipher
var cipherId = YourCipher.KeySetup('your-key');
var result = YourCipher.szEncryptBlock(cipherId, 'test-input');
console.log('Result:', result, 'Hex:', stringToHex(result));
YourCipher.ClearData(cipherId);
```

## 📝 Notes

- **Educational Purpose** - These implementations are designed for learning and experimentation
- **Not for Production** - Use established cryptographic libraries for real-world applications
- **Test Vectors** - Some test vectors are placeholders and should be updated with actual cipher outputs
- **Legacy Support** - Maintains compatibility with browsers from the early 2000s

## 📚 References

- RFC 4648 - Base64 Data Encodings
- NESSIE Project - European cryptographic algorithms
- Bruce Schneier's Applied Cryptography
- Various academic papers on cipher algorithms

---

*Part of the »SynthelicZ« cryptographic research collection*