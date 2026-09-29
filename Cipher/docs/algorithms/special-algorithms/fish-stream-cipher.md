# FISH Stream Cipher

> FISH (FIbonacci SHrinking) Stream Cipher designed by Blöcher and Dichtl (1993). Combines Lagged Fibonacci generators with shrinking generator principle for fast software implementation. Cryptographically broken by Ross Anderson.

## Properties

| Property | Value |
| --- | --- |
| Category | Special Algorithms |
| Sub-category | Stream Cipher |
| Security status | ❌ Broken |
| Complexity | Intermediate |
| Inventor | Blöcher, Dichtl |
| Year | 1993 |
| Origin | 🇩🇪 Germany |
| Source | [`algorithms/special/fish.js`](../../../algorithms/special/fish.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 4 bytes (32 bits) to 256 bytes (2048 bits) |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Known Plaintext Attack](https://www.cl.cam.ac.uk/~rja14/Papers/fish.pdf) | — | Ross Anderson demonstrated successful cryptanalysis with few thousand bits of known plaintext |
| [Statistical Weaknesses](https://en.wikipedia.org/wiki/FISH_(cipher)#Security) | — | Lagged Fibonacci generators have inherent statistical weaknesses exploitable in cryptanalysis |

## Documentation

- [FISH Specification](https://en.wikipedia.org/wiki/FISH_(cipher))
- [Siemens Technical Report](https://www.schneier.com/academic/archives/1994/09/description_of_a_new.html)

## References

- [Ross Anderson's Cryptanalysis](https://www.cl.cam.ac.uk/~rja14/Papers/fish.pdf)
- [Fast Software Encryption Workshop](https://link.springer.com/chapter/10.1007/3-540-60590-8_6)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Basic keystream generation](https://en.wikipedia.org/wiki/FISH_(cipher))

| Field | Value |
| --- | --- |
| `key` | `74657374` |
| `input` | `48656c6c6f20576f726c64` |
| `expected` | `ec865add438ba0a2fe556b` |

**Vector 2** — [Empty input test](https://en.wikipedia.org/wiki/FISH_(cipher))

| Field | Value |
| --- | --- |
| `key` | `746573746b6579` |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 3** — [Single byte test](https://en.wikipedia.org/wiki/FISH_(cipher))

| Field | Value |
| --- | --- |
| `key` | `6b657931` |
| `input` | `41` |
| `expected` | `fe` |

---

[← All algorithms](../README.md)
