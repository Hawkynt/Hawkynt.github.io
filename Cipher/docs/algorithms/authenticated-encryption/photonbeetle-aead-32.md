# PhotonBeetle-AEAD[32]

> NIST Lightweight Cryptography finalist with 32-bit rate. Optimized for constrained environments with smaller state updates for enhanced security margin.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Authenticated Encryption |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | Zhenzhen Bao, Avik Chakraborti, Nilanjan Datta, Jian Guo, Mridul Nandi, Thomas Peyrin, Kan Yasuda |
| Year | 2019 |
| Origin | 🌐 International |
| Source | [`algorithms/aead/photon-beetle.js`](../../../algorithms/aead/photon-beetle.js) |

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

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [PhotonBeetle Official Site](https://www.isical.ac.in/~lightweight/beetle/)
- [NIST LWC Specification](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/photon-beetle-spec-final.pdf)
- [NIST LWC Project](https://csrc.nist.gov/Projects/lightweight-cryptography)

## References

- [Official PHOTON-Beetle Reference Software](https://github.com/PHOTON-Beetle/Software)
- [rweather/lwc-finalists C Reference (embedded-optimized)](https://github.com/rweather/lwc-finalists)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST LWC Vector #1 (empty PT, empty AD)](https://csrc.nist.gov/Projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `df4e0bac1162408098fa5cf084d8f464` |

**Vector 2** — [NIST LWC Vector #2 (empty PT, 1-byte AD)](https://csrc.nist.gov/Projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `00` |
| `input` | _(empty)_ |
| `expected` | `e840449949081c5378e01eba6046dbe8` |

**Vector 3** — [NIST LWC Vector #5 (empty PT, 4-byte AD)](https://csrc.nist.gov/Projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `00010203` |
| `input` | _(empty)_ |
| `expected` | `e71c21d5cffb6d6f5c57725757831467` |

**Vector 4** — [NIST LWC KAT Count=34 (1-byte PT, empty AD)](https://csrc.nist.gov/Projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | _(empty)_ |
| `input` | `00` |
| `expected` | `315df91ea594d719d44f29e78e0ae94872` |

**Vector 5** — [NIST LWC KAT Count=133 (4-byte PT, empty AD)](https://csrc.nist.gov/Projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | _(empty)_ |
| `input` | `00010203` |
| `expected` | `31447c09c54cdeb0fd4d20607b6b733ffc021ec2` |

---

[← All algorithms](../README.md)
