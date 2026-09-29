# Grain v1

> Lightweight stream cipher using LFSR and NFSR designed for restricted hardware environments. Selected for eSTREAM Portfolio Profile 2. Uses 80-bit keys and 64-bit IVs with 160-bit total state.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🛡️ Secure |
| Complexity | Advanced |
| Inventor | Martin Hell, Thomas Johansson, and Willi Meier |
| Year | 2004 |
| Origin | 🇸🇪 Sweden |
| Source | [`algorithms/stream/grain.js`](../../../algorithms/stream/grain.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 10 bytes (80 bits) |
| Nonce sizes | 8 bytes (64 bits) |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [eSTREAM Grain v1 Specification](https://www.ecrypt.eu.org/stream/grainpf.html)
- [Grain - A New Stream Cipher](https://www.eit.lth.se/fileadmin/eit/courses/eit060f/Grain.pdf)
- [eSTREAM Portfolio](https://www.ecrypt.eu.org/stream/)

## References

- [Bouncy Castle Grainv1Engine Reference Implementation](https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/engines/Grainv1Engine.java)
- [eSTREAM Grain Portfolio Page](https://www.ecrypt.eu.org/stream/e2-grain.html)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [eSTREAM Grain v1 Test Vector](https://www.ecrypt.eu.org/stream/svn/viewcvs.cgi/ecrypt/trunk/submissions/grain/)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000` |
| `iv` | `0000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `7d405a412bfa1f7b` |

---

[← All algorithms](../README.md)
