# CFB

> Cipher Feedback mode converts a block cipher into a stream cipher by encrypting the previous ciphertext block (or IV) and XORing the result with plaintext. Self-synchronizing mode with error propagation properties. Both encryption and decryption use the block cipher in encryption mode only.

## Properties

| Property | Value |
| --- | --- |
| Category | Cipher Modes |
| Sub-category | Stream Cipher Mode |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | IBM/NIST |
| Year | 1981 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/modes/cfb.js`](../../../algorithms/modes/cfb.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| IV sizes | 8 bytes (64 bits) to 32 bytes (256 bits) in steps of 8 bytes |

## Capabilities

| Flag | Value |
| --- | --- |
| `RequiresIV` | Yes |

## Security

**Status:** 🛡️ Secure

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Error Propagation | Single bit error in ciphertext affects one block plus corresponding bit in next block. Not always a vulnerability but important characteristic. | — |
| IV Reuse | Reusing IV with same key creates keystream reuse vulnerability. Always use unique IVs. | — |
| Short Cycle Risk | In degenerate cases, feedback register might enter short cycle, though extremely unlikely with good block ciphers | — |

## Documentation

- [NIST SP 800-38A](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf)
- [FIPS 81](https://csrc.nist.gov/csrc/media/publications/fips/81/archive/1980-12-02/documents/fips81.pdf)
- ISO/IEC 10116 — ISO standard for modes of operation

## References

- Handbook of Applied Cryptography — Chapter 7 - Block Ciphers
- [OpenSSL CFB Implementation](https://github.com/openssl/openssl/blob/master/crypto/modes/cfb128.c)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST SP 800-38A CFB128 test vector](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `2b7e151628aed2a6abf7158809cf4f3c` |
| `iv` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `6bc1bee22e409f96e93d7e117393172a` |
| `expected` | `3b3fd92eb72dad20333449f8e83cfb4a` |

**Vector 2** — [NIST SP 800-38A CFB128 multi-block](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `2b7e151628aed2a6abf7158809cf4f3c` |
| `iv` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `6bc1bee22e409f96e93d7e117393172a ae2d8a571e03ac9c9eb76fac45af8e51 30c81c46a35ce411e5fbc1191a0a52ef f69f2445df4f9b17ad2b417be66c3710` |
| `expected` | `3b3fd92eb72dad20333449f8e83cfb4a c8a64537a0b3a93fcde3cdad9f1ce58b 26751f67a3cbb140b1808cf187a4f4df c04b05357c5d1c0eeac4c66f9ff7f2e6` |

---

[← All algorithms](../README.md)
