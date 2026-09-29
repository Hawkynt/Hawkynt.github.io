# XChaCha20 Extended-Nonce Stream Cipher

> Extended-nonce variant of ChaCha20 providing 192-bit nonces instead of 96-bit. Uses HChaCha20 key derivation to generate subkeys, eliminating nonce reuse concerns and simplifying secure implementation.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🧪 Experimental |
| Complexity | Not specified |
| Inventor | Daniel J. Bernstein (ChaCha20), Frank Denis (XChaCha20) |
| Year | 2018 |
| Origin | US |
| Source | [`algorithms/stream/xchacha20.js`](../../../algorithms/stream/xchacha20.js) |

## Capabilities

| Flag | Value |
| --- | --- |
| `isStreamCipher` | Yes |

## Security

**Status:** 🧪 Experimental

Extended ChaCha20 with 192-bit nonces. Educational implementation demonstrating nonce extension techniques.

No vulnerabilities are recorded for this implementation.

## Notes

- Extended-nonce variant of ChaCha20 with 192-bit nonces and HChaCha20 key derivation

## Background

- **overview:** XChaCha20 extends ChaCha20 with 192-bit nonces, eliminating birthday bound concerns and simplifying secure implementation.
- **keyFeatures:**
  - 192-bit nonces (3x larger than ChaCha20)
  - HChaCha20 key derivation for subkey generation
  - No nonce reuse concerns with random nonces
  - Compatible with ChaCha20 core operations
  - Practical solution for real-world applications
- **advantages:**
  - **Large nonce space:** 2^192 possible nonces eliminate collision concerns
  - **Simplified usage:** Random nonces can be safely used without counters
  - **Better security:** Resistant to nonce reuse attacks
  - **Practical engineering:** Solves real-world cryptographic implementation challenges
- **technicalDetails:**
  - **Key derivation:** HChaCha20 derives 256-bit subkeys from 256-bit master keys
  - **Nonce structure:** First 16 bytes for HChaCha20, last 8 bytes for ChaCha20
  - **Performance:** Minimal overhead compared to ChaCha20
  - **Compatibility:** Based on proven ChaCha20 core operations
- **usageExample:** // Simple encryption with random nonce const key = 'Your 32-byte secret key goes here!!'; const plaintext = 'Confidential message'; // Generate secure random nonce const nonce = XChaCha20.generateNonce(); // Encrypt const encrypted = XChaCha20.encrypt(key, XChaCha20.bytesToString(nonce), plaintext); // Decrypt const decrypted = XChaCha20.decrypt(key, XChaCha20.bytesToString(nonce), encrypted.ciphertext); console.log('Original:', plaintext); console.log('Decrypted:', decrypted.ciphertext);
- **securityNotes:**
  - Use cryptographically secure random nonce generation
  - 192-bit nonces eliminate birthday bound concerns
  - Never reuse nonces with the same key (though unlikely with random nonces)
  - This implementation is educational only - use proven libraries for production
- **practicalBenefits:**
  - Database encryption with deterministic nonces from record IDs
  - File encryption without nonce management complexity
  - Network protocols with simple nonce handling
  - Applications requiring many encryptions per key

## Documentation

- [draft-irtf-cfrg-xchacha](https://tools.ietf.org/html/draft-irtf-cfrg-xchacha)
- [ChaCha20 RFC 7539](https://tools.ietf.org/html/rfc7539)

## References

- [libsodium XChaCha20 Reference Implementation](https://github.com/jedisct1/libsodium)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — XChaCha20 Basic Test

Source: Educational test vector

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef` |
| `nonce` | `000102030405060708090a0b0c0d0e0f1011121314151617` |
| `input` | `48656c6c6f20576f726c64` |
| `expected` | `931b70ad80d05cf433f99f` |

---

[← All algorithms](../README.md)
