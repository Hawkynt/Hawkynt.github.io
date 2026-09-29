# ECDSA

> Elliptic Curve Digital Signature Algorithm over secp256k1, P-256, P-384 and P-521, signing a SHA-1 or SHA-2 digest with the deterministic nonce of RFC 6979 and producing a DER-encoded (r, s). Verified against the RFC 6979 signing vectors and the Wycheproof verification suites, including their invalid-encoding cases. Arithmetic is plain BigInt and is not constant-time, so a key used where an attacker can time the signer is not protected.

## Properties

| Property | Value |
| --- | --- |
| Category | Asymmetric Ciphers |
| Sub-category | Digital Signature |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Scott Vanstone |
| Year | 1992 |
| Origin | 🇨🇦 Canada |
| Source | [`algorithms/asymmetric/ecdsa.js`](../../../algorithms/asymmetric/ecdsa.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 256 bytes (2048 bits); 384 bytes (3072 bits); 521 bytes (4168 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Nonce Reuse and Bias](https://www.rfc-editor.org/rfc/rfc6979#section-3.2) | Two signatures made with the same k, or nonces with a handful of predictable bits, yield the private key directly from the pair of s values - this is how the PlayStation 3 code-signing key and a number of Bitcoin wallets were lost | Signing here derives k from the private key and the digest per RFC 6979, so no randomness source can go wrong; do not substitute a counter or a value derived from the message alone |
| [Timing and Trace Leakage](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.186-4.pdf) | Scalar multiplication here branches on the bits of the nonce, so an attacker able to time or trace the signer learns k and therefore the private key | Use a constant-time implementation wherever an attacker shares a machine with the signer; this file is a reference for the mathematics, not a hardened signer |

## Documentation

- [NIST FIPS 186-4 - Digital Signature Standard](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.186-4.pdf)
- [SEC 2: Recommended Elliptic Curve Domain Parameters](https://www.secg.org/sec2-v2.pdf)
- [RFC 6979 - Deterministic ECDSA](https://tools.ietf.org/html/rfc6979)
- [ANSI X9.62 - Public Key Cryptography for the Financial Services Industry](https://webstore.ansi.org/standards/ascx9/ansix9621998)

## References

- [OpenSSL ECDSA Implementation](https://github.com/openssl/openssl/blob/master/crypto/ec/ecdsa_ossl.c)
- [libsecp256k1](https://github.com/bitcoin-core/secp256k1)
- [Wycheproof ECDSA Test Vectors](https://github.com/C2SP/wycheproof/tree/main/testvectors_v1)

## Test vectors

12 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 6979 A.2.5 - P-256, SHA-256, message "sample"](https://www.rfc-editor.org/rfc/rfc6979#appendix-A.2)

| Field | Value |
| --- | --- |
| `curve` | secp256r1 |
| `hashAlgorithm` | SHA-256 |
| `privateKey` | `c9afa9d845ba75166b5c215767b1d6934e50c3db36e89b127b8a622b120f6721` |
| `input` | `73616d706c65` |
| `expected` | `3046022100efd48b2aacb6a8fd1140dd 9cd45e81d69d2c877b56aaf991c34d0e a84eaf3716022100f7cb1c942d657c41 d436c7a1b6e29f65f3e900dbb9aff406 4dc4ab2f843acda8` |

**Vector 2** — [RFC 6979 A.2.5 - P-256, SHA-256, message "test"](https://www.rfc-editor.org/rfc/rfc6979#appendix-A.2)

| Field | Value |
| --- | --- |
| `curve` | secp256r1 |
| `hashAlgorithm` | SHA-256 |
| `privateKey` | `c9afa9d845ba75166b5c215767b1d6934e50c3db36e89b127b8a622b120f6721` |
| `input` | `74657374` |
| `expected` | `3045022100f1abb023518351cd71d881 567b1ea663ed3efcf6c5132b354f28d3 b0b7d383670220019f4113742a2b14bd 25926b49c649155f267e60d3814b4c0c c84250e46f0083` |

**Vector 3** — [RFC 6979 A.2.5 - P-256, SHA-1, message "sample"](https://www.rfc-editor.org/rfc/rfc6979#appendix-A.2)

| Field | Value |
| --- | --- |
| `curve` | secp256r1 |
| `hashAlgorithm` | SHA-1 |
| `privateKey` | `c9afa9d845ba75166b5c215767b1d6934e50c3db36e89b127b8a622b120f6721` |
| `input` | `73616d706c65` |
| `expected` | `3044022061340c88c3aaebeb4f6d667f 672ca9759a6ccaa9fa8811313039ee4a 35471d3202206d7f147dac089441bb2e 2fe8f7a3fa264b9c475098fdcf6e00d7 c996e1b8b7eb` |

**Vector 4** — [RFC 6979 A.2.6 - P-384, SHA-384, message "sample"](https://www.rfc-editor.org/rfc/rfc6979#appendix-A.2)

| Field | Value |
| --- | --- |
| `curve` | secp384r1 |
| `hashAlgorithm` | SHA-384 |
| `privateKey` | `6b9d3dad2e1b8c1c05b19875b6659f4d e23c3b667bf297ba9aa47740787137d8 96d5724e4c70a825f872c9ea60d2edf5` |
| `input` | `73616d706c65` |
| `expected` | `306602310094edbb92a5ecb8aad4736e 56c691916b3f88140666ce9fa73d64c4 ea95ad133c81a648152e44acf96e36dd 1e80fabe4602310099ef4aeb15f178ce a1fe40db2603138f130e740a19624526 203b6351d0a3a94fa329c145786e679e 7b82c71a38628ac8` |

**Vector 5** — [RFC 6979 A.2.7 - P-521, SHA-512, message "sample"](https://www.rfc-editor.org/rfc/rfc6979#appendix-A.2)

| Field | Value |
| --- | --- |
| `curve` | secp521r1 |
| `hashAlgorithm` | SHA-512 |
| `privateKey` | `00fad06daa62ba3b25d2fb40133da757 205de67f5bb0018fee8c86e1b68c7e75 caa896eb32f1f47c70855836a6d16fcc 1466f6d8fbec67db89ec0c08b0e996b8 3538` |
| `input` | `73616d706c65` |
| `expected` | `308187024200c328fafcbd79dd778503 70c46325d987cb525569fb63c5d3bc53 950e6d4c5f174e25a1ee9017b5d45060 6add152b534931d7d4e8455cc91f9b15 bf05ec36e377fa0241617cce7cf50648 06c467f678d3b4080d6f1cc50af26ca2 09417308281b68af282623eaa63e5b5c 0723d8b8c37ff0777b1a20f8ccb1dccc 43997f1ee0e44da4a67a` |

**Vector 6** — [Wycheproof ecdsa_secp256r1_sha256 tcId 5 - valid signature](https://github.com/C2SP/wycheproof/blob/main/testvectors_v1/ecdsa_secp256r1_sha256_test.json)

| Field | Value |
| --- | --- |
| `curve` | secp256r1 |
| `hashAlgorithm` | SHA-256 |
| `publicKey` | `042927b10512bae3eddcfe467828128b ad2903269919f7086069c8c4df6c7328 38c7787964eaac00e5921fb1498a60f4 606766b3d9685001558d1a974e734151 3e` |
| `signature` | `304402202ba3a8be6b94d5ec80a6d9d1 190a436effe50d85a1eee859b8cc6af9 bd5c2e1802204cd60b855d442f5b3c7b 11eb6c4e0ae7525fe710fab9aa7c77a6 7f79e6fadd76` |
| `input` | `313233343030` |
| `expected` | `01` |

**Vector 7** — [Wycheproof ecdsa_secp256r1_sha256 tcId 7 - valid signature](https://github.com/C2SP/wycheproof/blob/main/testvectors_v1/ecdsa_secp256r1_sha256_test.json)

| Field | Value |
| --- | --- |
| `curve` | secp256r1 |
| `hashAlgorithm` | SHA-256 |
| `publicKey` | `042927b10512bae3eddcfe467828128b ad2903269919f7086069c8c4df6c7328 38c7787964eaac00e5921fb1498a60f4 606766b3d9685001558d1a974e734151 3e` |
| `signature` | `304502202ba3a8be6b94d5ec80a6d9d1 190a436effe50d85a1eee859b8cc6af9 bd5c2e18022100b329f479a2bbd0a5c3 84ee1493b1f5186a87139cac5df4087c 134b49156847db` |
| `input` | `313233343030` |
| `expected` | `01` |

**Vector 8** — [Wycheproof ecdsa_secp256r1_sha256 tcId 6 - invalid, s misses its leading zero](https://github.com/C2SP/wycheproof/blob/main/testvectors_v1/ecdsa_secp256r1_sha256_test.json)

| Field | Value |
| --- | --- |
| `curve` | secp256r1 |
| `hashAlgorithm` | SHA-256 |
| `publicKey` | `042927b10512bae3eddcfe467828128b ad2903269919f7086069c8c4df6c7328 38c7787964eaac00e5921fb1498a60f4 606766b3d9685001558d1a974e734151 3e` |
| `signature` | `304402202ba3a8be6b94d5ec80a6d9d1 190a436effe50d85a1eee859b8cc6af9 bd5c2e180220b329f479a2bbd0a5c384 ee1493b1f5186a87139cac5df4087c13 4b49156847db` |
| `input` | `313233343030` |
| `expected` | `00` |

**Vector 9** — [Wycheproof ecdsa_secp256r1_sha256 tcId 84 - invalid, zeros prepended to r](https://github.com/C2SP/wycheproof/blob/main/testvectors_v1/ecdsa_secp256r1_sha256_test.json)

| Field | Value |
| --- | --- |
| `curve` | secp256r1 |
| `hashAlgorithm` | SHA-256 |
| `publicKey` | `042927b10512bae3eddcfe467828128b ad2903269919f7086069c8c4df6c7328 38c7787964eaac00e5921fb1498a60f4 606766b3d9685001558d1a974e734151 3e` |
| `signature` | `3047022200002ba3a8be6b94d5ec80a6 d9d1190a436effe50d85a1eee859b8cc 6af9bd5c2e18022100b329f479a2bbd0 a5c384ee1493b1f5186a87139cac5df4 087c134b49156847db` |
| `input` | `313233343030` |
| `expected` | `00` |

**Vector 10** — [Wycheproof ecdsa_secp256r1_sha256 tcId 23 - invalid, zeros appended to the SEQUENCE](https://github.com/C2SP/wycheproof/blob/main/testvectors_v1/ecdsa_secp256r1_sha256_test.json)

| Field | Value |
| --- | --- |
| `curve` | secp256r1 |
| `hashAlgorithm` | SHA-256 |
| `publicKey` | `042927b10512bae3eddcfe467828128b ad2903269919f7086069c8c4df6c7328 38c7787964eaac00e5921fb1498a60f4 606766b3d9685001558d1a974e734151 3e` |
| `signature` | `304702202ba3a8be6b94d5ec80a6d9d1 190a436effe50d85a1eee859b8cc6af9 bd5c2e18022100b329f479a2bbd0a5c3 84ee1493b1f5186a87139cac5df4087c 134b49156847db0000` |
| `input` | `313233343030` |
| `expected` | `00` |

**Vector 11** — [Wycheproof ecdsa_secp256k1_sha256 tcId 1 - valid signature over the empty message](https://github.com/C2SP/wycheproof/blob/main/testvectors_v1/ecdsa_secp256k1_sha256_test.json)

| Field | Value |
| --- | --- |
| `curve` | secp256k1 |
| `hashAlgorithm` | SHA-256 |
| `publicKey` | `04782c8ed17e3b2a783b5464f33b0965 2a71c678e05ec51e84e2bcfc663a3de9 63af9acb4280b8c7f7c42f4ef9aba624 5ec1ec1712fd38a0fa96418d8cd6aa61 52` |
| `signature` | `3046022100f80ae4f96cdbc9d853f83d 47aae225bf407d51c56b7776cd67d0dc 195d99a9dc022100b303e26be1f73465 315221f0b331528807a1a9b6eb068ede 6eebeaaa49af8a36` |
| `input` | _(empty)_ |
| `expected` | `01` |

**Vector 12** — [Wycheproof ecdsa_secp256k1_sha256 tcId 3 - valid signature](https://github.com/C2SP/wycheproof/blob/main/testvectors_v1/ecdsa_secp256k1_sha256_test.json)

| Field | Value |
| --- | --- |
| `curve` | secp256k1 |
| `hashAlgorithm` | SHA-256 |
| `publicKey` | `04782c8ed17e3b2a783b5464f33b0965 2a71c678e05ec51e84e2bcfc663a3de9 63af9acb4280b8c7f7c42f4ef9aba624 5ec1ec1712fd38a0fa96418d8cd6aa61 52` |
| `signature` | `3045022100d035ee1f17fdb0b2681b16 3e33c359932659990af77dca632012b3 0b27a057b302201939d9f3b2858bc13e 3474cb50e6a82be44faa71940f876c1c ba4c3e989202b6` |
| `input` | `313233343030` |
| `expected` | `01` |

---

[← All algorithms](../README.md)
