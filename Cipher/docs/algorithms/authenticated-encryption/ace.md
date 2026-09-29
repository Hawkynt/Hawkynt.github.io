# ACE

> Lightweight authenticated encryption using sLiSCP-light-320 permutation in duplex sponge construction. NIST LWC Round 2 candidate with 128-bit security.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Lightweight Cryptography |
| Security status | 🧪 Experimental |
| Complexity | Intermediate |
| Inventor | Ismail Adomnitei, Thomas Peyrin |
| Year | 2019 |
| Origin | Not specified |
| Source | [`algorithms/aead/ace.js`](../../../algorithms/aead/ace.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 8 bytes (64 bits) |
| Tag sizes | 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | No |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [ACE Specification](https://uwaterloo.ca/communications-security-lab/lwc/ace)
- [NIST LWC Submission](https://csrc.nist.gov/projects/lightweight-cryptography)
- [Reference Implementation](https://github.com/rweather/lightweight-crypto)

## References

- [NIST LWC Round 2 Submission Package (Reference C)](https://csrc.nist.gov/projects/lightweight-cryptography/round-2-candidates)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST LWC KAT Count 1 (empty PT, empty AD)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ACE.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `02cf96dc6f171976f9ff4c3fc88e5bbe` |

**Vector 2** — [NIST LWC KAT Count 2 (empty PT, 1-byte AD)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ACE.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `00` |
| `input` | _(empty)_ |
| `expected` | `b61b4e1abcb1898ae58d1aec18cd131f` |

**Vector 3** — [NIST LWC KAT Count 9 (empty PT, 8-byte AD)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ACE.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `0001020304050607` |
| `input` | _(empty)_ |
| `expected` | `9616086ee453bab73f4069b13d0067b6` |

**Vector 4** — [NIST LWC KAT Count 17 (empty PT, 16-byte AD)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ACE.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `000102030405060708090a0b0c0d0e0f` |
| `input` | _(empty)_ |
| `expected` | `1bb495cb9d4cff617f9f53519666b0d1` |

**Vector 5** — [NIST LWC KAT Count 34 (1-byte PT, empty AD)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ACE.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | `00` |
| `expected` | `971c19196f86a7b77647d55156e8be3ed3` |

**Vector 6** — [NIST LWC KAT Count 35 (1-byte PT, 1-byte AD)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ACE.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `00` |
| `input` | `00` |
| `expected` | `2adc76d04eb5f3dae2dcacc9d5b27a52d5` |

**Vector 7** — [NIST LWC KAT Count 265 (8-byte PT, empty AD)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ACE.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | `0001020304050607` |
| `expected` | `97b9353fe3b7d4a15e7090ebe5b80dd491bcfff0d698e1c2` |

**Vector 8** — [NIST LWC KAT Count 529 (16-byte PT, empty AD)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ACE.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `97b9353fe3b7d4a1309d5a4ce3fd599432715f7128aa9858e39e89ddef90e996` |

---

[← All algorithms](../README.md)
