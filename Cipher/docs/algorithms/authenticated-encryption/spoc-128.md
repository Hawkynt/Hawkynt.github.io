# SpoC-128

> Lightweight AEAD using sLiSCP-light-256 permutation with 128-bit tag. Sponge-based construction optimized for resource-constrained devices.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | AEAD Cipher |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Kalikinkar Mandal, Dhiman Saha |
| Year | 2019 |
| Origin | 🌐 International |
| Source | [`algorithms/aead/spoc.js`](../../../algorithms/aead/spoc.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Nonce sizes | 16 bytes (128 bits) |
| Tag sizes | 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | No |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [SpoC Specification](https://uwaterloo.ca/communications-security-lab/lwc/spoc)
- [NIST LWC Round 2 Package](https://csrc.nist.gov/projects/lightweight-cryptography/round-2-candidates)

## References

- [rweather/lightweight-crypto C Reference Implementation](https://github.com/rweather/lightweight-crypto)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST LWC KAT Vector #1 - Empty plaintext and AD](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SpoC-128.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `5a32211f98add5ba77539a4660512dcb` |

**Vector 2** — [NIST LWC KAT Vector #2 - Empty plaintext with single AD byte](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SpoC-128.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `00` |
| `input` | _(empty)_ |
| `expected` | `1590ababdcaddcbf42f12f6e211407a0` |

**Vector 3** — [NIST LWC KAT Vector #34 - Single plaintext byte, empty AD](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SpoC-128.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | _(empty)_ |
| `input` | `00` |
| `expected` | `595154be7e7a3515ec09e9a1be55b02783` |

**Vector 4** — [NIST LWC KAT Vector #35 - Single plaintext byte with single AD byte](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SpoC-128.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `00` |
| `input` | `00` |
| `expected` | `ae7ceed1d556f2f0607f90c89c1208a6c9` |

**Vector 5** — [NIST LWC KAT Vector #169 - 5-byte plaintext with 3-byte AD (partial rate block)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SpoC-128.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `000102` |
| `input` | `0001020304` |
| `expected` | `65f7ace7f270b64a8608774bedfa7fcd6e17c04077` |

**Vector 6** — [NIST LWC KAT Vector #1089 - 32-byte plaintext with 32-byte AD (multiple full rate blocks)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SpoC-128.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `49a0541c4e10fb19bb20ec55115ff193 f8c1255dddd173cf79bab9135718aa59 c68bd981024c84e5135f17c10c3e7f56` |

---

[← All algorithms](../README.md)
