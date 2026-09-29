# RC5

> Variable symmetric block cipher with data-dependent rotations. Features configurable word size, rounds, and key length. This implementation uses RC5-32/12/16 (32-bit words, 12 rounds, up to 255-byte key).

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Ronald Rivest |
| Year | 1994 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/block/rc.js`](../../../algorithms/block/rc.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 0 bytes (0 bits) to 255 bytes (2040 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 2040 - RC5 Algorithm](https://tools.ietf.org/rfc/rfc2040.txt)
- [Original RC5 Paper](https://people.csail.mit.edu/rivest/Rivest-rc5rev.pdf)

## References

- [Rivest's RC5 Reference](https://people.csail.mit.edu/rivest/Rivest-rc5rev.pdf)
- [RC5 Patent (Expired)](https://patents.google.com/patent/US5724428A)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RC5-32/12/16 zero key, zero plaintext](https://github.com/cantora/avr-crypto-lib/blob/master/testvectors/Rc5-128-64.verified.test-vectors)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `21a5dbee154b8f6d` |

**Vector 2** — [RC5-32/12/16 pattern key and plaintext](https://tools.ietf.org/rfc/rfc2040.txt)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10` |
| `input` | `0123456789abcdef` |
| `expected` | `b734213608254d2f` |

**Vector 3** — [RC5-32/12/16 all ones key and plaintext](https://tools.ietf.org/rfc/rfc2040.txt)

| Field | Value |
| --- | --- |
| `key` | `ffffffffffffffffffffffffffffffff` |
| `input` | `ffffffffffffffff` |
| `expected` | `778769e9be0167b7` |

---

[← All algorithms](../README.md)
