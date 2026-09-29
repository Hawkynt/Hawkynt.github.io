# TupleHash128

> SHA-3 derived function for unambiguous tuple hashing with 128-bit security. Encodes each tuple element to prevent collisions between different tuple structures.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | SHA-3 Derived |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | John Kelsey, Shu-jen Chang, Ray Perlner (NIST) |
| Year | 2016 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/hash/tuplehash.js`](../../../algorithms/hash/tuplehash.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 1 byte (8 bits) to 1024 bytes (8192 bits) |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [NIST SP 800-185](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-185.pdf)
- [NIST Test Vectors](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/KMAC_samples.pdf)

## References

- [BouncyCastle TupleHash implementation](https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/digests/TupleHash.java)
- [XKCP - eXtended Keccak Code Package](https://github.com/XKCP/XKCP)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [TupleHash128: (000102, 101112131415), empty S, 32 bytes (NIST)](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/TupleHashTest.java)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `customization` | _(empty)_ |
| `tuples` | `[[0,1,2],[16,17,18,19,20,21]]` |
| `input` | `null` |
| `expected` | `c5d8786c1afb9b82111ab34b65b2c0048fa64e6d48e263264ce1707d3ffc8ed1` |

**Vector 2** — [TupleHash128: (000102, 101112131415), S='My Tuple App', 32 bytes (NIST)](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/TupleHashTest.java)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `customization` | `4d79205475706c6520417070` |
| `tuples` | `[[0,1,2],[16,17,18,19,20,21]]` |
| `input` | `null` |
| `expected` | `75cdb20ff4db1154e841d758e24160c54bae86eb8c13e7f5f40eb35588e96dfb` |

**Vector 3** — [TupleHash128: (000102, 101112131415, 202122232425262728), S='My Tuple App', 32 bytes (NIST)](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/TupleHashTest.java)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `customization` | `4d79205475706c6520417070` |
| `tuples` | `[[0,1,2],[16,17,18,19,20,21],[32,33,34,35,36,37,38,39,40]]` |
| `input` | `null` |
| `expected` | `e60f202c89a2631eda8d4c588ca5fd07f39e5151998deccf973adb3804bb6e84` |

**Vector 4** — [TupleHash128: NIST ACVP tg2/tc179 - empty element at position 3 of 7](https://raw.githubusercontent.com/usnistgov/ACVP-Server/master/gen-val/json-files/TupleHash-128-1.0/internalProjection.json)

| Field | Value |
| --- | --- |
| `outputSize` | `37` |
| `customization` | `4a774c6a` |
| `tuples` | `[[204,37,209,96,242],[55,12,28,102,213,7,214,227,20,233,133,38,199,77,82,113,160,20,236,243,149],[],[55,168,223,39,206,200,217,42,137,94,183,210,83,61,71,194,192,118,216,66,195,31,204],[172,220,219],[199,210,40,212,200,148,25,180,249,29,234,111,158],[146,251]]` |
| `input` | `null` |
| `expected` | `51ab471ee4b86fda531a588a61aa832a 9d0b4e8e7e982852e4defc7862ae8af6 ff01fc3a18` |

**Vector 5** — [TupleHash128: NIST ACVP tg1/tc48 - XOF mode, leading empty element](https://raw.githubusercontent.com/usnistgov/ACVP-Server/master/gen-val/json-files/TupleHash-128-1.0/internalProjection.json)

| Field | Value |
| --- | --- |
| `outputSize` | `49` |
| `xofMode` | Yes |
| `customization` | `636a5e4a5246372a73556c5a66202028 6b6676274a4b39287b35793b6e5b7744 695329256b73702d68647d357d405021 434c36` |
| `tuples` | `[[],[236,3,220,111,140,215,92,104,241,208,19,228,142,127,138,132,113,48,84,0,149,1,204,203,196,48,52,12,125,58,59,110,48,187,58,177,117,63,62,181,187,172,50,6,68,9,42,174,107,55,32,59,17,29,163,38,180,81,174,202,141,24,20,36,215,88,237,185,46,245,187,146,107,101,30,56,40,129,29,115,250,193,36,146,94,19,199,30,116,104,166,49,209,169,27,218,229,90,135,97,124,37,111,144,202,127,78,216,59,23,143,91,13…` |
| `input` | `null` |
| `expected` | `c0b00600a2148e4f8b2ed37a50381dac f7d8317901dc608d431ea3d50cc0d5a4 49893f7efcc9df9ee8d7fe249e99862c e7` |

---

[← All algorithms](../README.md)
