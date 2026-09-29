# LOKI89

> Early Australian block cipher designed by Lawrie Brown and Josef Pieprzyk. 64-bit Feistel cipher predecessor to LOKI97, featuring S-box substitutions and complex key schedule.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | ❌ Broken |
| Complexity | Intermediate |
| Inventor | Lawrie Brown, Josef Pieprzyk |
| Year | 1989 |
| Origin | 🇦🇺 Australia |
| Source | [`algorithms/block/loki.js`](../../../algorithms/block/loki.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 8 bytes (64 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Differential Cryptanalysis](https://link.springer.com/chapter/10.1007/3-540-55844-4_19) | Vulnerable to differential attacks due to weak S-box design | Use LOKI97 or modern ciphers instead |
| [Linear Cryptanalysis](https://link.springer.com/chapter/10.1007/3-540-55844-4_19) | Linear approximations break the cipher faster than brute force | Historical cipher - do not use for any security purpose |

## Documentation

- [LOKI89 Specification](https://link.springer.com/chapter/10.1007/3-540-47555-9_36)
- [Cryptanalysis of LOKI](https://link.springer.com/chapter/10.1007/3-540-55844-4_19)

## References

- [Original LOKI Paper](https://www.unsw.adfa.edu.au/~lpb/papers/loki.pdf)
- [Brown&Pieprzyk Design](https://link.springer.com/chapter/10.1007/3-540-47555-9_36)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [LOKI89 Educational Test Vector](https://www.unsw.adfa.edu.au/~lpb/papers/loki.pdf)

| Field | Value |
| --- | --- |
| `key` | `133457799bbcdff1` |
| `input` | `0123456789abcdef` |
| `expected` | `c304be5781629534` |

---

[← All algorithms](../README.md)
