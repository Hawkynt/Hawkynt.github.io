# ANSI X9.63 KDF

> ANSI X9.63-2001 Key Derivation Function for elliptic curve cryptography. Industry-standard KDF used in ECDH key agreement, financial cryptography, and smart card applications. Based on hash function iteration with counter and optional shared information.

## Properties

| Property | Value |
| --- | --- |
| Category | Key Derivation Functions |
| Sub-category | Hash-based KDF |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | ANSI X9F1 Cryptographic Tools Working Group |
| Year | 2001 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/kdf/x963kdf.js`](../../../algorithms/kdf/x963kdf.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 1 byte (8 bits) to 8160 bytes (65280 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SaltRequired` | No |

## Security

**Status:** 🛡️ Secure

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Weak Hash Function | SHA-1 is deprecated for security applications. Use SHA-256 or SHA-512 for new implementations. | — |
| Insufficient Shared Secret Length | NIST SP 800-56A Rev 3 requires shared secrets to be at least 112 bits (14 bytes) for security. | — |

## Documentation

- [ANSI X9.63-2001 - Public Key Cryptography for the Financial Services Industry](https://webstore.ansi.org/standards/ascx9/ansix9632001r2017)
- [SEC 1: Elliptic Curve Cryptography (Section 3.6.1)](https://www.secg.org/sec1-v2.pdf)
- [NIST SP 800-56A - Recommendation for Pair-Wise Key Establishment Schemes](https://csrc.nist.gov/publications/detail/sp/800-56a/rev-3/final)
- [ISO/IEC 18033-2 - Encryption Algorithms](https://www.iso.org/standard/37971.html)

## References

- [OpenSSL X963 KDF Implementation](https://github.com/openssl/openssl/blob/master/crypto/kdf/kdf_x963.c)
- [Python cryptography.hazmat.primitives.kdf.x963kdf](https://cryptography.io/en/latest/hazmat/primitives/key-derivation-functions/#x963kdf)
- [Bouncy Castle X9.63 KDF](https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/agreement/kdf/ECDHKEKGenerator.java)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST CAVP X9.63 KDF Test #1 - SHA1 with SharedInfo](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Algorithm-Validation-Program/documents/components/800-135testvectors/ansx963_2001.zip)

| Field | Value |
| --- | --- |
| `sharedInfo` | `856a53f3e36a26bbc5792879f307cce2` |
| `outputSize` | `128` |
| `hashFunction` | SHA1 |
| `input` | `fd17198b89ab39c4ab5d7cca363b82f9fd7e23c3984dc8a2` |
| `expected` | `6e5fad865cb4a51c95209b16df0cc490 bc2c9064405c5bccd4ee4832a531fbe7 f10cb79e2eab6ab1149fbd5a23cfdabc 41242269c9df22f628c4424333855b64 e95e2d4fb8469c669f17176c07d10337 6b10b384ec5763d8b8c610409f19aca8 eb31f9d85cc61a8d6d4a03d03e5a506b 78d6847e93d295ee548c65afedd2efec` |

**Vector 2** — [NIST CAVP X9.63 KDF Test #2 - SHA224 with SharedInfo](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Algorithm-Validation-Program/documents/components/800-135testvectors/ansx963_2001.zip)

| Field | Value |
| --- | --- |
| `sharedInfo` | `727997aed53e78f74b1d66743a4ea4d2` |
| `outputSize` | `128` |
| `hashFunction` | SHA224 |
| `input` | `da67a73072d521a8272c69023573012ddf9b46bff65b3900` |
| `expected` | `dfc3126c5eebf9a58d89730e8d8ff7cc 772592f28c10b349b437d9d068698a22 e532eae975dfaf9c5c6a9f2935eafb05 353013c253444e61f07bc9ddd15948e6 14bdc7e445ba3b1893f42f87f18fb352 d49956009a642c362d45410b43a9ab37 6e9261210739174759511d1f9e52f6ec 73dfed446dbafaf7fd1a57113abc2e8d` |

**Vector 3** — [NIST CAVP X9.63 KDF Test #3 - SHA256 with SharedInfo](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Algorithm-Validation-Program/documents/components/800-135testvectors/ansx963_2001.zip)

| Field | Value |
| --- | --- |
| `sharedInfo` | `75eef81aa3041e33b80971203d2c0c52` |
| `outputSize` | `128` |
| `hashFunction` | SHA256 |
| `input` | `22518b10e70f2a3f243810ae3254139efbee04aa57c7af7d` |
| `expected` | `c498af77161cc59f2962b9a713e2b215 152d139766ce34a776df11866a69bf2e 52a13d9c7c6fc878c50c5ea0bc7b00e0 da2447cfd874f6cf92f30d0097111485 500c90c3af8b487872d04685d14c8d1d c8d7fa08beb0ce0ababc11f0bd496269 142d43525a78e5bc79a17f59676a5706 dc54d54d4d1f0bd7e386128ec26afc21` |

**Vector 4** — [NIST CAVP X9.63 KDF Test #4 - SHA384 without SharedInfo](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Algorithm-Validation-Program/documents/components/800-135testvectors/ansx963_2001.zip)

| Field | Value |
| --- | --- |
| `sharedInfo` | _(empty)_ |
| `outputSize` | `16` |
| `hashFunction` | SHA384 |
| `input` | `d8554db1b392cd55c3fe957bed76af09c13ac2a9392f88f6` |
| `expected` | `671a46aada145162f8ddf1ca586a1cda` |

**Vector 5** — [NIST CAVP X9.63 KDF Test #5 - SHA384 with SharedInfo](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Algorithm-Validation-Program/documents/components/800-135testvectors/ansx963_2001.zip)

| Field | Value |
| --- | --- |
| `sharedInfo` | `1317504aa34759bb4c931e3b78201945` |
| `outputSize` | `128` |
| `hashFunction` | SHA384 |
| `input` | `c051fd22539c9de791d6c43a854b8f80a6bf70190050854a` |
| `expected` | `cf6a84434734ac6949e1d7976743277b e789906908ad3ca3a8923da7f476abbe b574306d7243031a85566914bfd247d2 519c479953d9d55b6b831e56260806c3 9af21b74e3ecf470e3bd8332791c8a23 c13352514fdef00c2d1a408ba31b2d3f 9fdcb373895484649a645d1845eec91b 5bfdc5ad28c7824984482002dd4a8677` |

**Vector 6** — [NIST CAVP X9.63 KDF Test #6 - SHA512 without SharedInfo](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Algorithm-Validation-Program/documents/components/800-135testvectors/ansx963_2001.zip)

| Field | Value |
| --- | --- |
| `sharedInfo` | _(empty)_ |
| `outputSize` | `16` |
| `hashFunction` | SHA512 |
| `input` | `87fc0d8c4477485bb574f5fcea264b30885dc8d90ad82782` |
| `expected` | `947665fbb9152153ef460238506a0245` |

**Vector 7** — [NIST CAVP X9.63 KDF Test #7 - SHA512 with SharedInfo (longer input)](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Algorithm-Validation-Program/documents/components/800-135testvectors/ansx963_2001.zip)

| Field | Value |
| --- | --- |
| `sharedInfo` | `e3b5b4c1b0d5cf1d2b3a2f9937895d31` |
| `outputSize` | `128` |
| `hashFunction` | SHA512 |
| `input` | `00aa5bb79b33e389fa58ceadc047197f 14e73712f452caa9fc4c9adb369348b8 1507392f1a86ddfdb7c4ff8231c4bd0f 44e44a1b55b1404747a9e2e753f55ef0 5a2d` |
| `expected` | `4463f869f3cc18769b52264b0112b585 8f7ad32a5a2d96d8cffabf7fa733633d 6e4dd2a599acceb3ea54a6217ce0b50e ef4f6b40a5c30250a5a8eeee20800226 7089dbf351f3f5022aa9638bf1ee419d ea9c4ff745a25ac27bda33ca08bd56dd 1a59b4106cf2dbbc0ab2aa8e2efa7b17 902d34276951ceccab87f9661c3e8816` |

---

[← All algorithms](../README.md)
