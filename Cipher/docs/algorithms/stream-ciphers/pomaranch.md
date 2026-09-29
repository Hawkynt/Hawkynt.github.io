# Pomaranch

> Educational implementation inspired by Pomaranch eSTREAM Phase 3 finalist. Uses nine linear feedback shift registers with nonlinear combining function.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Carlos Cid, Gaëtan Leurent |
| Year | 2005 |
| Origin | 🇬🇧 United Kingdom |
| Source | [`algorithms/stream/pomaranch.js`](../../../algorithms/stream/pomaranch.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) to 32 bytes (256 bits) in steps of 16 bytes |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Time-Memory-Data Tradeoff | Vulnerable to TMDT attacks and various algebraic attacks on LFSR structure | — |
| Educational Implementation | Simplified educational implementation - use only for learning | — |

## Documentation

- [eSTREAM Pomaranch Specification](https://www.ecrypt.eu.org/stream/p3ciphers/pomaranch/pomaranch_p3.pdf)
- [eSTREAM Portfolio](https://www.ecrypt.eu.org/stream/)

## References

- [eSTREAM Pomaranch Reference Source (archived)](https://web.archive.org/web/20110527044706/http://www.ecrypt.eu.org/stream/p3ciphers/pomaranch/pomaranch_p3source.zip)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Pomaranch Educational Test Vector 1 (Empty)

Source: Educational test case

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `0001020304050607` |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — Pomaranch Educational Test Vector 2 (Single Byte)

Source: Educational test case

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `0001020304050607` |
| `input` | `00` |
| `expected` | `ad` |

**Vector 3** — Pomaranch Educational Test Vector 3 (Two Bytes)

Source: Educational test case

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `0001020304050607` |
| `input` | `0001` |
| `expected` | `ad3a` |

**Vector 4** — Pomaranch Educational Test Vector 4 (Block)

Source: Educational test case

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `0001020304050607` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `ad3a0e371e5f3b91189ed272e1c8459f` |

---

[← All algorithms](../README.md)
