# Time-Lock Puzzle

> Timed-release cryptography that encrypts messages requiring specified computation time for decryption. Educational implementation of sequential computation time delays.

## Properties

| Property | Value |
| --- | --- |
| Category | Special Algorithms |
| Sub-category | Time-Release Cryptography |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Ronald Rivest, Adi Shamir, David Wagner |
| Year | 1996 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/special/time-lock-puzzle.js`](../../../algorithms/special/time-lock-puzzle.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [RSW96: Time-lock puzzles and timed-release Crypto](https://people.csail.mit.edu/rivest/pubs/RSW96.pdf)

## References

- [Time-Lock Puzzle Reference Implementation (RSW)](https://github.com/drummerjolev/time-lock-puzzle)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Educational Time-Lock Puzzle with short delay](https://people.csail.mit.edu/rivest/pubs/RSW96.pdf)

| Field | Value |
| --- | --- |
| `timeSteps` | `10000` |
| `input` | `536563726574` |
| `expected` | `536563726574` |

---

[← All algorithms](../README.md)
