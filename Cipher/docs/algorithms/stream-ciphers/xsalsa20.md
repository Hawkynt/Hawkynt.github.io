# XSalsa20

> Extended-nonce variant of Salsa20 stream cipher with 192-bit nonces. Uses HSalsa20 for subkey derivation enabling longer nonces without increased collision risk. Widely deployed in NaCl/LibSodium cryptographic library.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | Daniel J. Bernstein |
| Year | 2008 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/stream/xsalsa20.js`](../../../algorithms/stream/xsalsa20.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [XSalsa20 Specification](https://cr.yp.to/snuffle/xsalsa-20081128.pdf)
- [NaCl: Networking and Cryptography library](https://nacl.cr.yp.to/)
- [LibSodium Documentation](https://doc.libsodium.org/)

## References

- [libsodium Reference Implementation](https://github.com/jedisct1/libsodium)
- [NaCl Official Reference Implementation](https://nacl.cr.yp.to/install.html)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NaCl Test Vector 1 (192-bit nonce, 256-bit key)](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/XSalsa20Test.java)

| Field | Value |
| --- | --- |
| `key` | `a6a7251c1e72916d11c2cb214d3c252539121d8e234e652d651fa4c8cff88030` |
| `nonce` | `9e645a74e9e0a60d8243acd9177ab51a1beb8d5a2f5d700c` |
| `input` | `093c5e5585579625337bd3ab619d6157 60d8c5b224a85b1d0efe0eb8a7ee163a bb0376529fcc09bab506c618e13ce777 d82c3ae9d1a6f972d4160287cbfe60bf 2130fc0a6ff6049d0a5c8a82f429231f 008082e845d7e189d37f9ed2b464e6b9 19e6523a8c1210bd52a02a4c3fe406d3 085f5068d1909eeeca6369abc981a42e 87fe665583f0ab85ae71f6f84f528e6b 397af86f6917d9754b7320dbdc2fea81 496f2732f532ac78c4e9c6cfb18f8e9b df74622eb126141416776971a84f94d1 56beaf67aecbf2ad412e76e66e8fad76 33f5b6d7f3d64b5c6c69ce29003c6024 465ae3b89be78e915d88b4b5621d` |
| `expected` | `b2af688e7d8fc4b508c05cc39dd583d6 714322c64d7f3e63147aede2d9534934 b04ff6f337b031815cd094bdbc6d7a92 077dce709412286822ef0737ee47f6b7 ffa22f9d53f11dd2b0a3bb9fc01d9a88 f9d53c26e9365c2c3c063bc4840bfc81 2e4b80463e69d179530b25c158f54319 1cff993106511aa036043bbc75866ab7 e34afc57e2cce4934a5faae6eabe4f22 1770183dd060467827c27a354159a081 275a291f69d946d6fe28ed0b9ce08206 cf484925a51b9498dbde178ddd3ae91a 8581b91682d860f840782f6eea49dbb9 bd721501d2c67122dea3b7283848c5f1 3e0c0de876bd227a856e4de593a3` |

**Vector 2** — [NaCl Test Vector 2](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/XSalsa20Test.java)

| Field | Value |
| --- | --- |
| `key` | `9e1da239d155f52ad37f75c7368a536668b051952923ad44f57e75ab588e475a` |
| `nonce` | `af06f17859dffa799891c4288f6635b5c5a45eee9017fd72` |
| `input` | `feac9d54fc8c115ae247d9a7e919dd76 cfcbc72d32cae4944860817cbdfb8c04 e6b1df76a16517cd33ccf1acda920638 9e9e318f5966c093cfb3ec2d9ee2de85 6437ed581f552f26ac2907609df8c613 b9e33d44bfc21ff79153e9ef81a9d66c c317857f752cc175fd8891fefebb7d04 1e6517c3162d197e2112837d3bc41043 12ad35b75ea686e7c70d4ec04746b52f f09c421451459fb59f` |
| `expected` | `2c261a2f4e61a62e1b27689916bf0345 3fcbc97bb2af6f329391ef063b5a219b f984d07d70f602d85f6db61474e9d9f5 a2deecb4fcd90184d16f3b5b5e168ee0 3ea8c93f3933a22bc3d1a5ae8c2d8b02 757c87c073409052a2a8a41e7f487e04 1f9a49a0997b540e18621cad3a24f0a5 6d9b19227929057ab3ba950f6274b121 f193e32e06e5388781a1cb57317c0ba6 305e910961d01002f0` |

**Vector 3** — [NaCl Test Vector 3](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/XSalsa20Test.java)

| Field | Value |
| --- | --- |
| `key` | `d5c7f6797b7e7e9c1d7fd2610b2abf2bc5a7885fb3ff78092fb3abe8986d35e2` |
| `nonce` | `744e17312b27969d826444640e9c4a378ae334f185369c95` |
| `input` | `7758298c628eb3a4b6963c5445ef6697 1222be5d1a4ad839715d1188071739b7 7cc6e05d5410f963a64167629757` |
| `expected` | `27b8cfe81416a76301fd1eec6a4d9967 5069b2da2776c360db1bdfea7c0aa613 913e10f7a60fec04d11e65f2d64e` |

**Vector 4** — [NaCl Test Vector 4 (3-byte input)](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/XSalsa20Test.java)

| Field | Value |
| --- | --- |
| `key` | `6799d76e5ffb5b4920bc2768bafd3f8c16554e65efcf9a16f4683a7a06927c11` |
| `nonce` | `61ab951921e54ff06d9b77f313a4e49df7a057d5fd627989` |
| `input` | `472766` |
| `expected` | `8fd7df` |

**Vector 5** — [NaCl Test Vector 5 (long input)](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/XSalsa20Test.java)

| Field | Value |
| --- | --- |
| `key` | `f68238c08365bb293d26980a606488d09c2f109edafa0bbae9937b5cc219a49c` |
| `nonce` | `5190b51e9b708624820b5abdf4e40fad1fb950ad1adc2d26` |
| `input` | `47ec6b1f73c4b7ff5274a0bfd7f45f86 4812c85a12fbcb3c2cf8a3e90cf66ccf 2eacb521e748363c77f52eb426ae57a0 c6c78f75af71284569e79d1a92f949a9 d69c4efc0b69902f1e36d7562765543e 2d3942d9f6ff5948d8a312cff72c1afd 9ea3088aff7640bfd265f7a9946e606a bc77bcedae6bddc75a0dba0bd917d73e 3bd1268f727e0096345da1ed25cf553e a7a98fea6b6f285732de37431561ee1b 3064887fbcbd71935e02` |
| `expected` | `36160e88d3500529ba4edba17bc24d8c faca9a0680b3b1fc97cf03f3675b7ac3 01c883a68c071bc54acdd3b63af4a2d7 2f985e51f9d60a4c7fd481af10b2fc75 e252fdee7ea6b6453190617dcc6e2fe1 cd56585fc2f0b0e97c5c3f8ad7eb4f31 bc4890c03882aac24cc53acc19822965 26690a220271c2f6e326750d3fbda5d5 b63512c831f67830f59ac49aae330b3e 0e02c9ea0091d19841f1b0e13d69c9fb fe8a12d6f30bb734d9d2` |

---

[← All algorithms](../README.md)
