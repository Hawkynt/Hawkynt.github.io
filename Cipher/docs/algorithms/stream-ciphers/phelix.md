# Phelix

> Educational implementation inspired by Phelix stream cipher. eSTREAM candidate designed for high-speed authenticated encryption using XOR, addition mod 2^32, and rotation operations.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Doug Whiting, Bruce Schneier, Stefan Lucks, Frédéric Muller |
| Year | 2004 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/stream/phelix-simple.js`](../../../algorithms/stream/phelix-simple.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Key Recovery Attack | Wu and Preneel showed key recovery with 2^37 operations when nonces are reused | — |
| Educational Implementation | Simplified educational implementation - use only for learning | — |

## Documentation

- [Phelix Wikipedia](https://en.wikipedia.org/wiki/Phelix)
- [eSTREAM Project](https://www.ecrypt.eu.org/stream/)
- [Schneier on Security](https://www.schneier.com/academic/archives/2005/01/phelix.html)

## References

- [Phelix Reference Source Code (Designers)](https://www.schneier.com/wp-content/uploads/2016/02/phelix.zip)
- [Phelix x86-64 Assembler Implementation](https://www.schneier.com/wp-content/uploads/2005/01/phelix-x86-64.s)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Phelix Educational Test Vector 1 (Empty)

Source: Educational test case

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — Phelix Educational Test Vector 2 (Single Byte)

Source: Educational test case

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00` |
| `expected` | `a2` |

**Vector 3** — Phelix Educational Test Vector 3 (Two Bytes)

Source: Educational test case

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `0001` |
| `expected` | `a2ba` |

**Vector 4** — Phelix Educational Test Vector 4 (Block)

Source: Educational test case

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `a2ba9b5e4109cea6b815e83e3d807d61` |

---

[← All algorithms](../README.md)
