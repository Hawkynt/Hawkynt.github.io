# TEA-PRNG

> Pseudorandom number generator based on the Tiny Encryption Algorithm (TEA) operating in counter mode. Encrypts sequential 64-bit counter values to produce random output. Simple and fast but TEA's cryptographic weaknesses limit security.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Pseudorandom Number Generator |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | David Wheeler, Roger Needham |
| Year | 1994 |
| Origin | 🇬🇧 United Kingdom |
| Source | [`algorithms/random/tea-prng.js`](../../../algorithms/random/tea-prng.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [TEA: A Tiny Encryption Algorithm](https://www.cix.co.uk/~klockstone/tea.htm)
- [Cambridge Computer Laboratory TEA](https://www.cl.cam.ac.uk/teaching/1415/SecurityII/tea.pdf)
- [Original TEA Paper](https://link.springer.com/chapter/10.1007/3-540-60590-8_29)
- [Counter Mode Operation](https://en.wikipedia.org/wiki/Block_cipher_mode_of_operation#Counter_(CTR))

## References

- [Crypto++ TEA Implementation](https://github.com/weidai11/cryptopp/blob/master/tea.cpp)
- [Bouncy Castle TEA Implementation](https://github.com/bcgit/bc-csharp/blob/master/crypto/src/crypto/engines/TEAEngine.cs)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [TEA-PRNG with all-zero seed, counter=0 - First block](https://www.cix.co.uk/~klockstone/tea.htm)

| Field | Value |
| --- | --- |
| `seed` | `00000000000000000000000000000000` |
| `outputSize` | `8` |
| `input` | `null` |
| `expected` | `41ea3a0a94baa940` |

**Vector 2** — [TEA-PRNG with all-zero seed - First 16 bytes (2 blocks)](https://www.cix.co.uk/~klockstone/tea.htm)

| Field | Value |
| --- | --- |
| `seed` | `00000000000000000000000000000000` |
| `outputSize` | `16` |
| `input` | `null` |
| `expected` | `41ea3a0a94baa940414091a7a27f9c32` |

**Vector 3** — [TEA-PRNG with all-ones seed - First block](https://www.cix.co.uk/~klockstone/tea.htm)

| Field | Value |
| --- | --- |
| `seed` | `ffffffffffffffffffffffffffffffff` |
| `outputSize` | `8` |
| `input` | `null` |
| `expected` | `b94a017dde3f22cb` |

**Vector 4** — [TEA-PRNG with sequential seed - First 24 bytes (3 blocks)](https://www.cix.co.uk/~klockstone/tea.htm)

| Field | Value |
| --- | --- |
| `seed` | `0123456789abcdeffedcba9876543210` |
| `outputSize` | `24` |
| `input` | `null` |
| `expected` | `f257f7402d578cee9000e53c6e76457247665aec5ccf9639` |

**Vector 5** — [TEA-PRNG with ASCII seed - First block](https://www.cix.co.uk/~klockstone/tea.htm)

| Field | Value |
| --- | --- |
| `seed` | `59454c4c4f57205355424d4152494e45` |
| `outputSize` | `8` |
| `input` | `null` |
| `expected` | `aa3dc1152c9e1c64` |

---

[← All algorithms](../README.md)
