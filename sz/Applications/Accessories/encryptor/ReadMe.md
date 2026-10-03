# Data Encryption

A text encryption and decryption utility for the »SynthelicZ« desktop -- encrypts text of any language with AES-256-GCM under a passphrase and decrypts it back, entirely in the browser.

## Product Requirements

### Purpose
Data Encryption provides a lightweight encryption tool within the »SynthelicZ« desktop. Text is sealed with AES-256-GCM using a key derived from the user's passphrase (PBKDF2-SHA-256, random salt), so it can be shared or stored and only opened with the same passphrase.

### Key Capabilities
- AES-256-GCM encryption with a PBKDF2-SHA-256 key from the passphrase (250,000 iterations, random 16-byte salt, random 12-byte IV)
- Unicode text in, compact text out: `sze1:` followed by base64 of salt, IV and ciphertext with tag
- Tamper detection, with clear messages for a wrong passphrase or damaged text
- Decrypts hex output of the earlier XOR version
- Key validation with visual feedback for empty key attempts
- Clipboard integration (copy output) with Clipboard API and execCommand fallback
- Swap and Clear workflow actions for efficient encrypt/decrypt round-trips

### Design Reference
Inspired by simple encryption utilities and hex editors, presenting a straightforward input-key-output workflow reminiscent of classic Windows accessories like the Encoding/Decoding tools found in developer utility suites.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Uses the browser's Web Crypto API (available on https, localhost and local files)
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### Encryption

- [x] As a user, I can enter an encryption key in a password field
- [x] As a user, I can enter plaintext in the input textarea
- [x] As a user, I can click "Encrypt" to encrypt the input text with AES-256-GCM under my passphrase
- [x] As a user, I can see the encrypted result as `sze1:` text in the output textarea
- [x] As a user, I can encrypt text in any language, emoji included

### Decryption

- [x] As a user, I can enter encrypted text in the input textarea
- [x] As a user, I can click "Decrypt" to get the original text back with the same passphrase
- [x] As a user, I can see an error message for a wrong passphrase, changed or incomplete text, or input that is not encrypted output
- [x] As a user, I can still decrypt hex text made by the earlier XOR version

### Key Validation

- [x] As a user, I can see a visual flash error on the key field when I try to encrypt/decrypt without entering a key
- [x] As a user, I can see the encryption/decryption operation cancelled if no key is provided

### Clipboard and Workflow

- [x] As a user, I can click "Swap" to exchange the input and output values
- [x] As a user, I can click "Copy" to copy the output to the clipboard
- [x] As a user, I can see the Copy button use the Clipboard API with a fallback to execCommand
- [x] As a user, I can click "Clear" to reset the key, input, and output fields

### User Interface

- [x] As a user, I can see a note naming the cipher and that the text cannot be recovered without the passphrase
- [x] As a user, I can see the output textarea is read-only
- [x] As a user, I can see error output styled differently from normal output
- [x] As a user, I can see themed visual styles matching the current desktop skin
- [x] As a user, I can see an About dialog with application information

### Aspirational Features

- [ ] As a user, I can select from multiple encryption algorithms via a dropdown
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
