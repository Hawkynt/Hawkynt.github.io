# Data Encryption

A simple XOR-based text encryption and decryption utility for the »SynthelicZ« desktop -- providing a straightforward interface for encoding text into hex-encoded ciphertext and decoding it back, primarily for demonstration purposes.

## Product Requirements

### Purpose
Data Encryption provides a lightweight encryption tool within the »SynthelicZ« desktop, allowing users to experiment with basic XOR-based text encryption and decryption. It demonstrates cryptographic concepts in an accessible way while offering practical (albeit not production-grade) text obfuscation through a clean, easy-to-use interface.

### Key Capabilities
- XOR-based text encryption with user-provided key
- Hex-encoded ciphertext output and hex-to-plaintext decryption
- Input validation with descriptive error messages for malformed hex data
- Key validation with visual feedback for empty key attempts
- Clipboard integration (copy output) with Clipboard API and execCommand fallback
- Swap and Clear workflow actions for efficient encrypt/decrypt round-trips

### Design Reference
Inspired by simple encryption utilities and hex editors, presenting a straightforward input-key-output workflow reminiscent of classic Windows accessories like the Encoding/Decoding tools found in developer utility suites.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### Encryption

- [x] As a user, I can enter an encryption key in a password field
- [x] As a user, I can enter plaintext in the input textarea
- [x] As a user, I can click "Encrypt" to XOR-encrypt the input text with the key and produce hex output
- [x] As a user, I can see the encrypted result displayed as a hexadecimal string in the output textarea

### Decryption

- [x] As a user, I can enter hex-encoded ciphertext in the input textarea
- [x] As a user, I can click "Decrypt" to XOR-decrypt the hex input with the key and produce plaintext
- [x] As a user, I can see an error message when the hex input is invalid (empty, odd length, or non-hex characters)
- [x] As a user, I can see a specific explanation of why hex validation failed

### Key Validation

- [x] As a user, I can see a visual flash error on the key field when I try to encrypt/decrypt without entering a key
- [x] As a user, I can see the encryption/decryption operation cancelled if no key is provided

### Clipboard and Workflow

- [x] As a user, I can click "Swap" to exchange the input and output values
- [x] As a user, I can click "Copy" to copy the output to the clipboard
- [x] As a user, I can see the Copy button use the Clipboard API with a fallback to execCommand
- [x] As a user, I can click "Clear" to reset the key, input, and output fields

### User Interface

- [x] As a user, I can see a disclaimer stating that XOR encryption is for demonstration only
- [x] As a user, I can see the output textarea is read-only
- [x] As a user, I can see error output styled differently from normal output
- [x] As a user, I can see themed visual styles matching the current desktop skin

### Aspirational Features

- [ ] As a user, I can select from multiple encryption algorithms (AES, DES, Blowfish, etc.) via a dropdown
- [ ] As a user, I can toggle between text and file mode to encrypt/decrypt files
- [ ] As a user, I can see a password strength indicator for the entered key
- [ ] As a user, I can toggle key visibility (show/hide password)
- [ ] As a user, I can generate a random encryption key
- [ ] As a user, I can choose output encoding format (hex, base64, raw bytes)
- [ ] As a user, I can see a hash/checksum of the input and output for verification
- [ ] As a user, I can drag and drop text or files onto the input area
- [ ] As a user, I can save encrypted output directly to the VFS
- [ ] As a user, I can load input from a VFS file
- [ ] As a user, I can use keyboard shortcuts (Ctrl+E to encrypt, Ctrl+D to decrypt)
- [ ] As a user, I can see the byte length of both input and output displayed
