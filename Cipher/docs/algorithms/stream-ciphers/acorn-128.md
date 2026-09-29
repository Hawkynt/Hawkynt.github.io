# ACORN-128

> Production-grade authenticated encryption with associated data (AEAD) stream cipher. CAESAR competition winner for lightweight cryptography with 128-bit security and efficient implementation.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | AEAD Stream Cipher |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | Hongjun Wu, Tao Huang, Phuong Pham, Steven Sim |
| Year | 2016 |
| Origin | Not specified |
| Source | [`algorithms/stream/acorn.js`](../../../algorithms/stream/acorn.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Nonce sizes | 16 bytes (128 bits) |
| Tag sizes | 8 bytes (64 bits) to 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | No |

## Security

**Status:** 🛡️ Secure

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Implementation Attacks | Side-channel vulnerabilities in software implementations without proper countermeasures | Use constant-time implementation and appropriate side-channel protection |
| Weak Key Classes | Very small subset of keys may have slightly reduced security margins (theoretical) | Use proper random key generation - no practical impact for random keys |

## Documentation

- [CAESAR Competition Specification v3](https://competitions.cr.yp.to/round3/acornv3.pdf)
- [CAESAR Competition Results](https://competitions.cr.yp.to/caesar-submissions.html)
- [ACORN Official Website](https://acorn-cipher.org/)
- [NIST Lightweight Cryptography](https://csrc.nist.gov/projects/lightweight-cryptography)

## References

- [Reference Implementation (C)](https://github.com/hongjun-wu/ACORN-128)
- [Arduino Crypto Library](https://rweather.github.io/arduinolibs/classAcorn128.html)
- [CAESAR Benchmarks](https://bench.cr.yp.to/results-aead.html)
- [Security Analysis Papers](https://acorn-cipher.org/security.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [CAESAR ACORN-128 Test Vector 1 (Empty Message)](https://competitions.cr.yp.to/round3/acornv3.pdf)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `iv` | `00000000000000000000000000000000` |
| `aad` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `835e5317896e86b2447143c74f6ffc1e` |

**Vector 2** — [CAESAR ACORN-128 Test Vector 2 (Single Byte)](https://competitions.cr.yp.to/round3/acornv3.pdf)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `iv` | `00000000000000000000000000000000` |
| `aad` | _(empty)_ |
| `input` | `01` |
| `expected` | `2b4b60640e26f0a99dd01f93bf634997cb` |

**Vector 3** — [CAESAR ACORN-128 Test Vector 3 (AAD Only)](https://competitions.cr.yp.to/round3/acornv3.pdf)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `iv` | `00000000000000000000000000000000` |
| `aad` | `01` |
| `input` | _(empty)_ |
| `expected` | `982ef7d1bba7f89a1575297a095cd7f2` |

---

[← All algorithms](../README.md)
