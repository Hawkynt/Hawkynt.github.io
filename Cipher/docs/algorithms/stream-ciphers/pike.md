# PIKE

> Educational implementation inspired by Pike stream cipher. Designed by Ross Anderson using three lagged Fibonacci generators with clock control mechanism.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Not specified |
| Inventor | Ross Anderson |
| Year | 1994 |
| Origin | GB |
| Source | [`algorithms/stream/pike.js`](../../../algorithms/stream/pike.js) |

## Capabilities

| Flag | Value |
| --- | --- |
| `cantDecode` | No |

## Security

**Status:** 🎓 Educational Only

Educational implementation only. Pike was designed to replace FISH but has potential vulnerabilities. Use only for educational purposes.

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| This is a simplified educational implementation | — | Use only for learning about lagged Fibonacci generators |

## Documentation

- [Pike Cipher Wikipedia](https://en.wikipedia.org/wiki/Pike_(cipher))
- [Lagged Fibonacci Generators](https://en.wikipedia.org/wiki/Lagged_Fibonacci_generator)
- [Ross Anderson's Work](https://www.cl.cam.ac.uk/~rja14/)

## References

- [FISH Cryptanalysis](https://www.cl.cam.ac.uk/~rja14/Papers/fibonacci.pdf)
- [Pike Design Notes](https://en.wikipedia.org/wiki/Pike_(cipher))
- [Anderson's Publications](https://www.cl.cam.ac.uk/~rja14/papers.html)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Pike Educational Test Vector 1 (Empty)

Source: Educational test case

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `iv` | `000102030405060708090a0b0c0d0e0f` |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — Pike Educational Test Vector 2 (Single Byte)

Source: Educational test case

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `iv` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00` |
| `expected` | `20` |

**Vector 3** — Pike Educational Test Vector 3 (Two Bytes)

Source: Educational test case

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `iv` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `0001` |
| `expected` | `20bf` |

**Vector 4** — Pike Educational Test Vector 4 (Block)

Source: Educational test case

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `iv` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `20bf4e19ec9f6a19f89b3efdb47732d1` |

---

[← All algorithms](../README.md)
