# ORANGE-Zest

> NIST Lightweight Cryptography candidate using PHOTON-256 permutation with efficient keystream generation and GF(128) operations for authenticated encryption.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Authenticated Encryption |
| Security status | 🧪 Experimental |
| Complexity | Intermediate |
| Inventor | Zhenzhen Bao, Avik Chakraborti, Nilanjan Datta, Jian Guo, Mridul Nandi, Thomas Peyrin, Kan Yasuda |
| Year | 2019 |
| Origin | 🌐 International |
| Source | [`algorithms/aead/orange.js`](../../../algorithms/aead/orange.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Tag sizes | 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | No |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [ORANGE Official Website](https://www.isical.ac.in/~lightweight/Orange/)
- [NIST LWC Project Page](https://csrc.nist.gov/Projects/lightweight-cryptography)
- [ORANGE Specification](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/round-2/spec-doc-rnd2/orange-spec-round2.pdf)

## References

- [ORANGE Reference Software Package (ISI Kolkata)](https://www.isical.ac.in/~lightweight/Orange/ORANGE.tar.gz)
- [rweather lightweight-crypto ORANGE Source](https://github.com/rweather/lightweight-crypto/tree/master/src/individual/ORANGE)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST KAT Vector #1 - Empty PT and AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `f315bf7b2779ef4b99f8cc33b7155755` |

**Vector 2** — [NIST KAT Vector #2 - Empty PT, 1-byte AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `00` |
| `input` | _(empty)_ |
| `expected` | `3e23ce190d4c8fca425d39a3776341b2` |

**Vector 3** — [NIST KAT Vector #5 - Empty PT, 4-byte AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `00010203` |
| `input` | _(empty)_ |
| `expected` | `ab63b2ade8e854bcb72dbe00a29ebbc6` |

**Vector 4** — [NIST KAT Vector #34 - 1-byte PT, empty AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | _(empty)_ |
| `input` | `00` |
| `expected` | `bc3791431f6a798a76ae57a5177d909210` |

**Vector 5** — [NIST KAT Vector #35 - 1-byte PT, 1-byte AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `00` |
| `input` | `00` |
| `expected` | `cba400078fac89a39288303677e5a08984` |

**Vector 6** — [NIST KAT Vector #38 - 1-byte PT, 4-byte AD](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `00010203` |
| `input` | `00` |
| `expected` | `4ed50a9171537daad559b399342fdce743` |

**Vector 7** — [NIST KAT Vector #169 - 5-byte PT, 3-byte AD (partial block)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ORANGE-Zest.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `000102` |
| `input` | `0001020304` |
| `expected` | `98973390f20ab5083c9dd60b822162a7978bc2e2e5` |

**Vector 8** — [NIST KAT Vector #1089 - 32-byte PT, 32-byte AD (full block boundary)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/ORANGE-Zest.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `b0991c016366c43f3cf727a44410df56 525f4a7be395b05db3dfb3bfcd4aafb9 12a8537d95006a47d43df8ea8a7c10fb` |

---

[← All algorithms](../README.md)
