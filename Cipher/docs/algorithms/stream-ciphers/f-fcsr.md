# F-FCSR

> Feedback with Carry Shift Register stream cipher based on eSTREAM specification. Uses FCSR automaton with binary expansion of 2-adic numbers for keystream generation.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | FCSR Stream Cipher |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | François Arnault, Thierry Berger, Cédric Lauradoux |
| Year | 2005 |
| Origin | Not specified |
| Source | [`algorithms/stream/f-fcsr.js`](../../../algorithms/stream/f-fcsr.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 10 bytes (80 bits); 16 bytes (128 bits) |
| Nonce sizes | 8 bytes (64 bits) |

## Security

**Status:** not classified — treat as unverified.

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Cryptographically Broken | F-FCSR has been cryptanalytically broken and should not be used for actual security - educational purposes only | — |

## Documentation

- [eSTREAM Portfolio](https://www.ecrypt.eu.org/stream/)
- [F-FCSR Specification](https://www.ecrypt.eu.org/stream/ciphers/ffcsr/ffcsr.pdf)
- [FCSR Theory](https://link.springer.com/chapter/10.1007/3-540-68697-5_1)

## References

- [Cryptanalysis of F-FCSR](https://eprint.iacr.org/2006/263)
- [FCSR Automata](https://hal.archives-ouvertes.fr/hal-00000000)
- [Academic Paper](https://www.di.ens.fr/~joux/pub/FCSR.pdf)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — F-FCSR Test Vector 1 (Educational)

Source: Educational implementation test

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `0001020304050607` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `00ab0203aeafac07a2090aa1a6a70ea5` |

**Vector 2** — F-FCSR Test Vector 2 (Shorter input)

Source: Educational implementation test

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `0001020304050607` |
| `input` | `00010203040506070809` |
| `expected` | `00ab0203aeafac07a209` |

---

[← All algorithms](../README.md)
