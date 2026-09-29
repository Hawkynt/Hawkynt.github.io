# Damm-Check-Digit

> Damm algorithm using anti-symmetric quasigroups for optimal single-digit error detection Validates identification numbers to detect transcription errors.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Check Digit Validation |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | H. Michael Damm |
| Year | 2004 |
| Origin | 🇩🇪 Germany |
| Source | [`algorithms/checksum/check-digit.js`](../../../algorithms/checksum/check-digit.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Not Cryptographically Secure | Designed only for detecting accidental errors, not malicious attacks | — |
| Limited Security | Cannot protect against intentional manipulation by knowledgeable attackers | — |

## Documentation

- [Damm Algorithm Wikipedia](https://en.wikipedia.org/wiki/Damm_algorithm)
- [PhD Thesis](https://www.diva-portal.org/smash/get/diva2:831173/FULLTEXT01.pdf)
- [Quasigroup Theory](https://en.wikipedia.org/wiki/Quasigroup)

## References

- [Singapore IPOS](https://www.ipos.gov.sg/)
- [Anti-symmetric Operations](https://mathworld.wolfram.com/Quasigroup.html)
- [Error Detection Theory](https://link.springer.com/article/10.1007/s00200-003-0143-1)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Valid 7-digit number

Source: Educational test vector

| Field | Value |
| --- | --- |
| `input` | `05070204030403` |
| `expected` | `01` |

**Vector 2** — Invalid 7-digit number

Source: Educational test vector

| Field | Value |
| --- | --- |
| `input` | `05070204030404` |
| `expected` | `00` |

**Vector 3** — Valid 12-digit number

Source: Educational test vector

| Field | Value |
| --- | --- |
| `input` | `090102030405060708090009` |
| `expected` | `01` |

---

[← All algorithms](../README.md)
