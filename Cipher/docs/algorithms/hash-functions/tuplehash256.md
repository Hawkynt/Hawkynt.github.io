# TupleHash256

> SHA-3 derived function for unambiguous tuple hashing with 256-bit security. Encodes each tuple element to prevent collisions between different tuple structures.

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

**Vector 1** — [TupleHash256: (000102, 101112131415), empty S, 64 bytes (NIST)](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/TupleHashTest.java)

| Field | Value |
| --- | --- |
| `outputSize` | `64` |
| `customization` | _(empty)_ |
| `tuples` | `[[0,1,2],[16,17,18,19,20,21]]` |
| `input` | `null` |
| `expected` | `cfb7058caca5e668f81a12a20a2195ce 97a925f1dba3e7449a56f82201ec6073 11ac2696b1ab5ea2352df1423bde7bd4 bb78c9aed1a853c78672f9eb23bbe194` |

**Vector 2** — [TupleHash256: (000102, 101112131415), S='My Tuple App', 64 bytes (NIST)](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/TupleHashTest.java)

| Field | Value |
| --- | --- |
| `outputSize` | `64` |
| `customization` | `4d79205475706c6520417070` |
| `tuples` | `[[0,1,2],[16,17,18,19,20,21]]` |
| `input` | `null` |
| `expected` | `147c2191d5ed7efd98dbd96d7ab5a116 92576f5fe2a5065f3e33de6bba9f3aa1 c4e9a068a289c61c95aab30aee1e410b 0b607de3620e24a4e3bf9852a1d4367e` |

**Vector 3** — [TupleHash256: (000102, 101112131415, 202122232425262728), S='My Tuple App', 64 bytes (NIST)](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/TupleHashTest.java)

| Field | Value |
| --- | --- |
| `outputSize` | `64` |
| `customization` | `4d79205475706c6520417070` |
| `tuples` | `[[0,1,2],[16,17,18,19,20,21],[32,33,34,35,36,37,38,39,40]]` |
| `input` | `null` |
| `expected` | `45000be63f9b6bfd89f54717670f69a9 bc763591a4f05c50d68891a744bcc6e7 d6d5b5e82c018da999ed35b0bb49c967 8e526abd8e85c13ed254021db9e790ce` |

**Vector 4** — [TupleHash256: NIST ACVP tg2/tc120 - leading empty element, empty S](https://raw.githubusercontent.com/usnistgov/ACVP-Server/master/gen-val/json-files/TupleHash-256-1.0/internalProjection.json)

| Field | Value |
| --- | --- |
| `outputSize` | `38` |
| `customization` | _(empty)_ |
| `tuples` | `[[],[174,186,93,164,36,5,116,23,99,61,98,229,140,248,25,79,68,75,19,73,244,193,160,49,6,127,36,59,78,95,38,154,114,98,99,91,233,79,190,136,112,26,40,74,105,60,217,149,153,234,70,165,145,183,56,17,22,71,243,226,142,228,49,139,135,204,34,101,142,179,57,139,240,165,0,45,210,182,121,250,97,179,32,128,234,173,102,149,200,241,14,34,218,174,45,112,71,251,0,227,54,59,72,186,106,49,82,248,76,0,3,36,106,206…` |
| `input` | `null` |
| `expected` | `6eb8e712b3cdafdfce02d786a0eec430 5cab4f2aa10611743fef8b5192822fdd 4d74468873d4` |

**Vector 5** — [TupleHash256: NIST ACVP tg1/tc82 - XOF mode, leading empty element](https://raw.githubusercontent.com/usnistgov/ACVP-Server/master/gen-val/json-files/TupleHash-256-1.0/internalProjection.json)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `xofMode` | Yes |
| `customization` | `2857675f733f30636144776b6b2e6e43 735876616269662d5b757d486460322b 3257575b2f29794c7529796c5a7c3377 5577693e705d793e715a237d41677e21 326c59345532346a5f49` |
| `tuples` | `[[],[195,145,201,134,139,140,109,228,150,188,220,73,234,55,188,228,33,150,203,213,33,24,71,172,26,123,6,94,242,251,147,50,173,63,234,181,71,137,116,109,188,152,133,159,74,94,67,214,129,124,84,40,143,220,104,174,71,17,16,0,249,41,124,28,92,39,167,46,14,62,97,118,190,91,177,138,198,142,190,42,123,0,136,110,23,239,90,85,110,248,243,168,255,51,200,109,34,75,45,9,136,191,215,10,235,108,23,233,50,214,16…` |
| `input` | `null` |
| `expected` | `0cded52b4886a6eeb886e57e1fa4b055060f33bc5a68d3fd45f06692a52073bb` |

---

[← All algorithms](../README.md)
