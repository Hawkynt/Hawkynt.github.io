# Spritz

> Sponge-like stream cipher designed as RC4 successor by Rivest and Schuldt. Uses 256-byte state with absorb/squeeze operations similar to Keccak/SHA-3 construction.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Sponge-based Stream Cipher |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Ron Rivest, Jacob Schuldt |
| Year | 2014 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/stream/spritz.js`](../../../algorithms/stream/spritz.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 1 byte (8 bits) to 256 bytes (2048 bits) |
| Nonce sizes | 0 bytes (0 bits) to 256 bytes (2048 bits) |

## Security

**Status:** 🧪 Experimental

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Limited Analysis | Newer algorithm with less cryptanalytic scrutiny than established ciphers | Use well-established stream ciphers for production systems |
| Performance Concerns | More complex than RC4 with potentially slower performance | Consider performance requirements for target applications |

## Documentation

- [Spritz Paper (Rivest and Schuldt)](https://people.csail.mit.edu/rivest/pubs/RS14.pdf)
- [Spritz Cryptanalysis](https://eprint.iacr.org/2016/856.pdf)
- [Rivest's Spritz Page](https://people.csail.mit.edu/rivest/Spritz/)

## References

- [jedisct1/spritz C Reference Implementation](https://github.com/jedisct1/spritz)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Spritz Basic Test

Source: Educational test case based on Rivest and Schuldt specification

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `06256ff1baf8bbdc38dcc328c9bd21dc` |

---

[← All algorithms](../README.md)
