# RC6

> AES finalist designed as evolution of RC5. Features 128-bit blocks, variable key sizes, and data-dependent rotations with quadratic nonlinearity. Patented algorithm with strong security properties.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Ron Rivest, Matt Robshaw, Ray Sidney, Yiqun Lisa Yin |
| Year | 1998 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/block/rc.js`](../../../algorithms/block/rc.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) to 32 bytes (256 bits) in steps of 8 bytes |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [RC6 Algorithm Specification](https://people.csail.mit.edu/rivest/Rivest-rc6.pdf)
- [AES Candidate Submission](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/archived-crypto-projects/aes-development)

## References

- [RC6 Technical Report](https://people.csail.mit.edu/rivest/pubs/RRSY98.pdf)
- [RC6 Patent Information](https://patents.google.com/patent/US6269163B1)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [IETF test vector - RC6-32/20/16 (128-bit key)](https://datatracker.ietf.org/doc/html/draft-krovetz-rc6-rc5-vectors-00)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `3a96f9c7f6755cfe46f00e3dcd5d2a3c` |

---

[← All algorithms](../README.md)
