# Pyjamask-96 AEAD

> NIST lightweight cryptography candidate using 96-bit block cipher with OCB mode. Features efficient masking against side-channel attacks.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Lightweight Cryptography |
| Security status | 🧪 Experimental |
| Complexity | Intermediate |
| Inventor | Dahmun Goudarzi, Jérémy Jean, Stefan Kölbl, Thomas Peyrin, Matthieu Rivain, Yu Sasaki, Siang Meng Sim |
| Year | 2019 |
| Origin | 🌐 International |
| Source | [`algorithms/aead/pyjamask96.js`](../../../algorithms/aead/pyjamask96.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Tag sizes | 12 bytes (96 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | No |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [NIST LWC Project](https://csrc.nist.gov/Projects/lightweight-cryptography)
- [Pyjamask Specification](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/pyjamask-spec-final.pdf)
- [OCB Mode RFC 7253](https://tools.ietf.org/html/rfc7253)

## References

- [Official Pyjamask Reference Implementation](https://github.com/pyjamask-cipher/pyjamask-reference-implementation)
- [Pyjamask Cipher Project Site](https://pyjamask-cipher.github.io/)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Pyjamask-96: Empty message, empty AAD (Count 1)](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-submissions/pyjamask-kat.zip)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `0001020304050607` |
| `aad` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `488f6d07a0acb94ba38daff6` |

**Vector 2** — [Pyjamask-96: Empty message with 1-byte AAD (Count 2)](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-submissions/pyjamask-kat.zip)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `0001020304050607` |
| `aad` | `00` |
| `input` | _(empty)_ |
| `expected` | `a4080d3107179d4e79914d6c` |

**Vector 3** — [Pyjamask-96: 1-byte plaintext, empty AAD (Count 34)](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-submissions/pyjamask-kat.zip)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `0001020304050607` |
| `aad` | _(empty)_ |
| `input` | `00` |
| `expected` | `e93e779812b77693e67b3747fa` |

**Vector 4** — [Pyjamask-96: 1-byte plaintext, 8-byte AAD (Count 42)](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-submissions/pyjamask-kat.zip)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `0001020304050607` |
| `aad` | `0001020304050607` |
| `input` | `00` |
| `expected` | `e94385dd68fca0483b70e02629` |

**Vector 5** — [Pyjamask-96: 12-byte plaintext (full block), empty AAD (Count 397)](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-submissions/pyjamask-kat.zip)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `0001020304050607` |
| `aad` | _(empty)_ |
| `input` | `000102030405060708090a0b` |
| `expected` | `91801abe9aa41562d34d07b30e13800f7d7608223c9197e4` |

---

[← All algorithms](../README.md)
