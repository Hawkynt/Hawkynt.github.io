# SipHash-2-4

> Fast cryptographically secure pseudorandom function designed for hash tables and data structures requiring collision resistance.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | MAC/PRF |
| Security status | 🎓 Educational Only |
| Complexity | Not specified |
| Inventor | Jean-Philippe Aumasson, Daniel J. Bernstein |
| Year | 2012 |
| Origin | 🌐 International |
| Source | [`algorithms/hash/siphash.js`](../../../algorithms/hash/siphash.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Key Management | Security depends on secret key - key reuse or weak keys reduce security | Use strong random 128-bit keys, rotate keys periodically |

## Documentation

- [SipHash Paper](https://cr.yp.to/siphash/siphash-20120918.pdf)
- [RFC 9018 (DNS Cookie usage)](https://www.rfc-editor.org/rfc/rfc9018.txt)
- [SipHash Official Repository](https://github.com/veorq/SipHash)

## References

- [Redis Hash Table Usage](https://github.com/redis/redis)
- [Linux Kernel Usage](https://git.kernel.org/)
- [Rust HashMap Implementation](https://github.com/rust-lang/rust)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [vectors.h entry 0 - empty message](https://github.com/veorq/SipHash/blob/master/vectors.h)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | _(empty)_ |
| `expected` | `310e0edd47db6f72` |

**Vector 2** — [vectors.h entry 1 - one byte](https://github.com/veorq/SipHash/blob/master/vectors.h)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00` |
| `expected` | `fd67dc93c539f874` |

**Vector 3** — [vectors.h entry 7 - one byte under the 8-byte block](https://github.com/veorq/SipHash/blob/master/vectors.h)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00010203040506` |
| `expected` | `37d1018bf50002ab` |

**Vector 4** — [vectors.h entry 8 - exactly one block](https://github.com/veorq/SipHash/blob/master/vectors.h)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `0001020304050607` |
| `expected` | `6224939a79f5f593` |

**Vector 5** — [vectors.h entry 9 - one byte over a block](https://github.com/veorq/SipHash/blob/master/vectors.h)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708` |
| `expected` | `b0e4a90bdf82009e` |

**Vector 6** — [vectors.h entry 16 - two whole blocks](https://github.com/veorq/SipHash/blob/master/vectors.h)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `db9bc2577fcc2a3f` |

**Vector 7** — [vectors.h entry 63 - 63 bytes](https://github.com/veorq/SipHash/blob/master/vectors.h)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e` |
| `expected` | `724506eb4c328a95` |

---

[← All algorithms](../README.md)
