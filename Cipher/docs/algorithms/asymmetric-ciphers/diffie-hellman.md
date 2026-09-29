# Diffie-Hellman

> Key agreement over a finite field: each party publishes g^x mod p for its own private exponent x and raises the value it receives to that same exponent, so both reach the shared secret without transmitting it. Carries the RFC 3526 safe-prime groups and the RFC 5114 groups, and validates a received public value by range and, where the subgroup order is published, by checking membership of the order-q subgroup. The modular exponentiation uses native BigInt and is not constant-time, so it leaks the private exponent to a timing observer and is unsuitable for use against an adversary who can measure it.

## Properties

| Property | Value |
| --- | --- |
| Category | Asymmetric Ciphers |
| Sub-category | Key Exchange Protocol |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Whitfield Diffie, Martin Hellman |
| Year | 1976 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/asymmetric/diffie-hellman.js`](../../../algorithms/asymmetric/diffie-hellman.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 20 bytes (160 bits) to 1024 bytes (8192 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Man-in-the-Middle Attack](https://en.wikipedia.org/wiki/Diffie%E2%80%93Hellman_key_exchange#Security) | Unauthenticated Diffie-Hellman agrees a key with whoever answers. An active attacker runs one exchange with each side and relays between them, holding both shared secrets. | Authenticate the public values, for example by signing them or by confirming the derived key |
| [Small Subgroup Confinement](https://www.rfc-editor.org/rfc/rfc2631) | A public value crafted to lie in a small subgroup forces the shared secret into that same small set, so it can be guessed and, repeated across exchanges, recovers the private exponent. | Reject values outside [2, p-2] and, where the subgroup order q is published, reject any y with y^q mod p not equal to 1. Both checks are applied here. |
| [Logjam](https://weakdh.org/) | Precomputation against a widely shared 512-bit or 768-bit prime amortises over every exchange that uses it, so export-grade groups fall to a one-off effort. | Use a 2048-bit group or larger; no group below 1024 bits is offered here |
| [Non-Constant-Time Exponentiation](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-56Ar3.pdf) | The square-and-multiply loop in this implementation branches on the bits of the private exponent, so its running time depends on the secret. | Use a constant-time implementation such as OpenSSL's for any adversarial setting |

## Documentation

- [Original DH Paper (1976)](https://ee.stanford.edu/~hellman/publications/24.pdf)
- [RFC 2631 - Diffie-Hellman Key Agreement Method](https://www.rfc-editor.org/rfc/rfc2631)
- [RFC 3526 - More MODP Groups for IKE](https://www.rfc-editor.org/rfc/rfc3526)
- [RFC 5114 - Additional Diffie-Hellman Groups (test data in Appendix A)](https://www.rfc-editor.org/rfc/rfc5114)
- [NIST SP 800-56A Rev. 3 - Key Establishment Using Discrete Logarithm Cryptography](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-56Ar3.pdf)
- [Wikipedia - Diffie-Hellman key exchange](https://en.wikipedia.org/wiki/Diffie%E2%80%93Hellman_key_exchange)

## References

- [OpenSSL DH Implementation](https://github.com/openssl/openssl/blob/master/crypto/dh/dh_key.c)
- [Crypto++ DH Implementation](https://github.com/weidai11/cryptopp/blob/master/dh.h)
- [Python cryptography library DH](https://github.com/pyca/cryptography/tree/main/src/cryptography/hazmat/primitives/asymmetric)

## Test vectors

12 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 5114 Appendix A.1 - 1024-bit MODP Group with 160-bit Prime Order Subgroup - party A derives the shared secret Z from yB and xA](https://www.rfc-editor.org/rfc/rfc5114#appendix-A.1)

| Field | Value |
| --- | --- |
| `group` | modp1024s160 |
| `privateKey` | `b9a3b3ae8fefc1a2930496507086f8455d48943e` |
| `input` | `717a6cb053371ff4a3b932941c1e5663 f861a1d6ad34ae66576dfb98f6c6cbf9 ddd5a56c7833f6bcfdff095582ad868e 440e8d09fd769e3ceccdc3d3b1e4cfa0 57776caaf9739b6a9fee8e7411f8d6da c09d6a4edb46cc2b5d5203090eae6126 311e53fd2c14b574e6a3109a3da1be41 bdceaa186f5ce06716a2b6a07b3c33fe` |
| `expected` | `5c804f454d30d9c4df85271f93528c91 df6b48ab5f80b3b59caac1b28f8acba9 cd3e39f3cb614525d9521d2e644c53b8 07b810f340062f257d7d6fbfe8d5e8f0 72e9b6e9afda9413eafb2e8b0699b1fb 5a0caceddeaead7e9cfbb36ae2b42083 5bd83a19fb0b5e96bf8fa4d09e345525 167ecd9155416f46f408ed31b63c6e6d` |

**Vector 2** — [RFC 5114 Appendix A.1 - 1024-bit MODP Group with 160-bit Prime Order Subgroup - party B derives the same shared secret Z from yA and xB](https://www.rfc-editor.org/rfc/rfc5114#appendix-A.1)

| Field | Value |
| --- | --- |
| `group` | modp1024s160 |
| `privateKey` | `9392c9f9eb6a7a6a9022f7d83e7223c6835bbdda` |
| `input` | `2a853b3d92197501b9015b2deb3ed84f 5e021dcc3e52f109d3273d2b7521281c babe0e76ff5727fa8acce26956ba9a1f ca26f20228d8693feb10841d84a73600 54ece5a7f5b7a61ad3dfb3c60d2e4310 6d8727da37df9cce95b478755d06bcea 8f9d45965f75a5f3d1df3701165fc9e5 0c4279ceb07f989540ae96d5d88ed776` |
| `expected` | `5c804f454d30d9c4df85271f93528c91 df6b48ab5f80b3b59caac1b28f8acba9 cd3e39f3cb614525d9521d2e644c53b8 07b810f340062f257d7d6fbfe8d5e8f0 72e9b6e9afda9413eafb2e8b0699b1fb 5a0caceddeaead7e9cfbb36ae2b42083 5bd83a19fb0b5e96bf8fa4d09e345525 167ecd9155416f46f408ed31b63c6e6d` |

**Vector 3** — [RFC 5114 Appendix A.1 - 1024-bit MODP Group with 160-bit Prime Order Subgroup - party A public value yA from private exponent xA](https://www.rfc-editor.org/rfc/rfc5114#appendix-A.1)

| Field | Value |
| --- | --- |
| `group` | modp1024s160 |
| `privateKey` | `b9a3b3ae8fefc1a2930496507086f8455d48943e` |
| `input` | _(empty)_ |
| `expected` | `2a853b3d92197501b9015b2deb3ed84f 5e021dcc3e52f109d3273d2b7521281c babe0e76ff5727fa8acce26956ba9a1f ca26f20228d8693feb10841d84a73600 54ece5a7f5b7a61ad3dfb3c60d2e4310 6d8727da37df9cce95b478755d06bcea 8f9d45965f75a5f3d1df3701165fc9e5 0c4279ceb07f989540ae96d5d88ed776` |

**Vector 4** — [RFC 5114 Appendix A.1 - 1024-bit MODP Group with 160-bit Prime Order Subgroup - party B public value yB from private exponent xB](https://www.rfc-editor.org/rfc/rfc5114#appendix-A.1)

| Field | Value |
| --- | --- |
| `group` | modp1024s160 |
| `privateKey` | `9392c9f9eb6a7a6a9022f7d83e7223c6835bbdda` |
| `input` | _(empty)_ |
| `expected` | `717a6cb053371ff4a3b932941c1e5663 f861a1d6ad34ae66576dfb98f6c6cbf9 ddd5a56c7833f6bcfdff095582ad868e 440e8d09fd769e3ceccdc3d3b1e4cfa0 57776caaf9739b6a9fee8e7411f8d6da c09d6a4edb46cc2b5d5203090eae6126 311e53fd2c14b574e6a3109a3da1be41 bdceaa186f5ce06716a2b6a07b3c33fe` |

**Vector 5** — [RFC 5114 Appendix A.2 - 2048-bit MODP Group with 224-bit Prime Order Subgroup - party A derives the shared secret Z from yB and xA](https://www.rfc-editor.org/rfc/rfc5114#appendix-A.2)

| Field | Value |
| --- | --- |
| `group` | modp2048s224 |
| `privateKey` | `22e62601dbffd06708a680f747f361f76d8f4f721a0548e483294b0c` |
| `input` | `4dcee992a9762a13f2f83844ad3d77ee 0e31c9718b3db6c2035d3961182c3e0b a247ec4182d760cd48d99599970622a1 881bba2dc822939c78c3912c6661fa54 38b20766222b75e24c2e3ad0c7287236 129525ee15b5dd7998aa04c4a9696cac d7172083a97a81664ead2c479e444e4c 0654cc19e28d7703cee8dacd6126f5d6 65ec52c67255db92014b037eb621a2ac 8e365de071ffc1400acf077a12913dd8 de89473437ab7ba346743c1b215dd9c1 2164a7e4053118d199bec8ef6fc56117 0c84c87d10ee9a674a1fa8ffe13bdfba 1d44de48946d68dc0cdd777635a7ab5b fb1e4bb7b856f96827734c184138e915 d9c3002ebce53120546a7e2002142b6c` |
| `expected` | `34d9bddc1b42176c313fea034c21034d 074a6313bb4ecdb3703fff424567a46b df75530ede0a9da5229de7d76732286c bc0f91da4c3c852fc099c679531d94c7 8ab03d9decb0a4e4ca8b2bb4591c4021 cf8ce3a20a541d33994017d0200ae2c9 516e2ff5145779269e862b0fb474a2d5 6dc31ed569a7700b4c4ab16b22a45513 531ef523d71212077b5a169bdeffad7a d9608284c7795b6d5a5183b87066de17 d8d671c9ebd8ec89544d45ec061593d4 42c62ab9ce3b1cb9943a1d23a5ea3bcf 21a01471e67e003e7f8a69c728be490b 2fc88cfeb92db6a215e5d03c17c464c9 ac1a46e203e13f952995fb03c69d3cc4 7fcb510b6998ffd3aa6de73cf9f63869` |

**Vector 6** — [RFC 5114 Appendix A.2 - 2048-bit MODP Group with 224-bit Prime Order Subgroup - party B derives the same shared secret Z from yA and xB](https://www.rfc-editor.org/rfc/rfc5114#appendix-A.2)

| Field | Value |
| --- | --- |
| `group` | modp2048s224 |
| `privateKey` | `4ff3bc96c7fc6a6d71d3b363800a7cdfef6fc41b4417ea15353b7590` |
| `input` | `1b3a63451bd886e699e67b494e288bd7 f8e0d370badda7a0efd2fde7d8f66145 cc9f280419975eb808877c8a4c0c8e0b d48d4a5401eb1e8776bfeee134c03831 ac273cd9d635ab0ce006a42a887e3f52 fb8766b650f38078bc8ee8580cefe243 968cfc4f8dc3db084554171d41bf2e86 1b7bb4d69dd0e01ea387cbaa5ca672af cbe8bdb9d62d4ce15f17dd36f91ed1ee dd65ca4a06455cb94cd40a52ec360e84 b3c926e22c4380a3bf309d56849768b7 f52cfdf655fd053a7ef706979e7e5806 b17dfae53ad2a5bc568ebb529a7a61d6 8d256f8fc97c074a861d827e2ebc8c61 34553115b70e7103920aa16d85e52bcb ab8d786a68178fa8ff7c2f5c71648d6f` |
| `expected` | `34d9bddc1b42176c313fea034c21034d 074a6313bb4ecdb3703fff424567a46b df75530ede0a9da5229de7d76732286c bc0f91da4c3c852fc099c679531d94c7 8ab03d9decb0a4e4ca8b2bb4591c4021 cf8ce3a20a541d33994017d0200ae2c9 516e2ff5145779269e862b0fb474a2d5 6dc31ed569a7700b4c4ab16b22a45513 531ef523d71212077b5a169bdeffad7a d9608284c7795b6d5a5183b87066de17 d8d671c9ebd8ec89544d45ec061593d4 42c62ab9ce3b1cb9943a1d23a5ea3bcf 21a01471e67e003e7f8a69c728be490b 2fc88cfeb92db6a215e5d03c17c464c9 ac1a46e203e13f952995fb03c69d3cc4 7fcb510b6998ffd3aa6de73cf9f63869` |

**Vector 7** — [RFC 5114 Appendix A.2 - 2048-bit MODP Group with 224-bit Prime Order Subgroup - party A public value yA from private exponent xA](https://www.rfc-editor.org/rfc/rfc5114#appendix-A.2)

| Field | Value |
| --- | --- |
| `group` | modp2048s224 |
| `privateKey` | `22e62601dbffd06708a680f747f361f76d8f4f721a0548e483294b0c` |
| `input` | _(empty)_ |
| `expected` | `1b3a63451bd886e699e67b494e288bd7 f8e0d370badda7a0efd2fde7d8f66145 cc9f280419975eb808877c8a4c0c8e0b d48d4a5401eb1e8776bfeee134c03831 ac273cd9d635ab0ce006a42a887e3f52 fb8766b650f38078bc8ee8580cefe243 968cfc4f8dc3db084554171d41bf2e86 1b7bb4d69dd0e01ea387cbaa5ca672af cbe8bdb9d62d4ce15f17dd36f91ed1ee dd65ca4a06455cb94cd40a52ec360e84 b3c926e22c4380a3bf309d56849768b7 f52cfdf655fd053a7ef706979e7e5806 b17dfae53ad2a5bc568ebb529a7a61d6 8d256f8fc97c074a861d827e2ebc8c61 34553115b70e7103920aa16d85e52bcb ab8d786a68178fa8ff7c2f5c71648d6f` |

**Vector 8** — [RFC 5114 Appendix A.2 - 2048-bit MODP Group with 224-bit Prime Order Subgroup - party B public value yB from private exponent xB](https://www.rfc-editor.org/rfc/rfc5114#appendix-A.2)

| Field | Value |
| --- | --- |
| `group` | modp2048s224 |
| `privateKey` | `4ff3bc96c7fc6a6d71d3b363800a7cdfef6fc41b4417ea15353b7590` |
| `input` | _(empty)_ |
| `expected` | `4dcee992a9762a13f2f83844ad3d77ee 0e31c9718b3db6c2035d3961182c3e0b a247ec4182d760cd48d99599970622a1 881bba2dc822939c78c3912c6661fa54 38b20766222b75e24c2e3ad0c7287236 129525ee15b5dd7998aa04c4a9696cac d7172083a97a81664ead2c479e444e4c 0654cc19e28d7703cee8dacd6126f5d6 65ec52c67255db92014b037eb621a2ac 8e365de071ffc1400acf077a12913dd8 de89473437ab7ba346743c1b215dd9c1 2164a7e4053118d199bec8ef6fc56117 0c84c87d10ee9a674a1fa8ffe13bdfba 1d44de48946d68dc0cdd777635a7ab5b fb1e4bb7b856f96827734c184138e915 d9c3002ebce53120546a7e2002142b6c` |

**Vector 9** — [RFC 5114 Appendix A.3 - 2048-bit MODP Group with 256-bit Prime Order Subgroup - party A derives the shared secret Z from yB and xA](https://www.rfc-editor.org/rfc/rfc5114#appendix-A.3)

| Field | Value |
| --- | --- |
| `group` | modp2048s256 |
| `privateKey` | `0881382cdb87660c6dc13e614938d5b9c8b2f248581cc5e31b35454397fce50e` |
| `input` | `575f0351bd2b1b817448bdf87a6c362c 1e289d3903a30b9832c5741fa250363e 7acbc7f77f3dacbc1f131add8e03367e ff8fbbb3e1c5784424809b25afe4d226 2a1a6fd2fab64105ca30a674e07f7809 852088632fc049233791ad4edd083a97 8b883ee618bc5e0dd047415f2d95e683 cf14826b5fbe10d3ce41c6c120c78ab2 0008c698bf7f0bcab9d7f407bed0f43a fb2970f57f8d12043963e66ddd320d59 9ad9936c8f44137c08b180ec5e985ceb e186f3d549677e80607331ee17af3380 a725b0782317d7dd43f59d7af9568a9b b63a84d365f92244ed120988219302f4 2924c7ca90b89d24f71b0ab697823d7d eb1aff5b0e8e4a45d49f7f53757e1913` |
| `expected` | `86c70bf8d0bb81bb01078a17219cb7d2 7203db2a19c877f1d1f19fd7d77ef225 46a68f005ad52dc84553b78fc60330be 51ea7c0672cac1515e4b35c047b9a551 b88f39dc26da14a09ef74774d47c762d d177f9ed5bc2f11e52c879bd95098504 cd9eecd8a8f9b3efbd1f008ac5853097 d9d1837f2b18f77cd7be01af80a7c7b5 ea3ca54cc02d0c116fee3f95bb873993 85875d7e86747e676e728938acbff709 8e05be4dcfb24052b83aeffb14783f02 9adbde7f53fae92084224090e007cee9 4d4bf2bace9ffd4b57d2af7c724d0caa 19bf0501f6f17b4aa10f425e3ea76080 b4b9d6b3cefea115b2ceb8789bb8a3b0 ea87febe63b6c8f846ec6db0c26c5d7c` |

**Vector 10** — [RFC 5114 Appendix A.3 - 2048-bit MODP Group with 256-bit Prime Order Subgroup - party B derives the same shared secret Z from yA and xB](https://www.rfc-editor.org/rfc/rfc5114#appendix-A.3)

| Field | Value |
| --- | --- |
| `group` | modp2048s256 |
| `privateKey` | `7d62a7e3ef36de617b13d1afb82c780d83a23bd4ee6705645121f371f546a53d` |
| `input` | `2e9380c8323af97545bc4941deb0ec37 42c62fe0ece824a6abdbe66c59bee024 2911bfb967235ceba35ae13e4ec752be 630b92dc4bde2847a9c62cb815274542 1fb7eb60a63c0fe9159fcce726ce7cd8 523d7450667ef840e4919121eb5f01c8 c9b0d3d648a93bfb75689e8244ac134a f544711ce79a02dcc34226684780dddc b498594106c37f5bc79856487af5ab02 2a2e5e42f09897c1a85a11ea0212af04 d9b4cebc937c3c1a3e15a8a0342e3376 15c84e7fe3b8b9b87fb1e73a15af12a3 0d746e06dfc34f290d797ce51aa13aa7 85bf6658aff5e4b093003cbeaf665b3c 2e113a3a4e905269341dc0711426685f 4ef37e868a8126ff3f2279b57ca67e29` |
| `expected` | `86c70bf8d0bb81bb01078a17219cb7d2 7203db2a19c877f1d1f19fd7d77ef225 46a68f005ad52dc84553b78fc60330be 51ea7c0672cac1515e4b35c047b9a551 b88f39dc26da14a09ef74774d47c762d d177f9ed5bc2f11e52c879bd95098504 cd9eecd8a8f9b3efbd1f008ac5853097 d9d1837f2b18f77cd7be01af80a7c7b5 ea3ca54cc02d0c116fee3f95bb873993 85875d7e86747e676e728938acbff709 8e05be4dcfb24052b83aeffb14783f02 9adbde7f53fae92084224090e007cee9 4d4bf2bace9ffd4b57d2af7c724d0caa 19bf0501f6f17b4aa10f425e3ea76080 b4b9d6b3cefea115b2ceb8789bb8a3b0 ea87febe63b6c8f846ec6db0c26c5d7c` |

**Vector 11** — [RFC 5114 Appendix A.3 - 2048-bit MODP Group with 256-bit Prime Order Subgroup - party A public value yA from private exponent xA](https://www.rfc-editor.org/rfc/rfc5114#appendix-A.3)

| Field | Value |
| --- | --- |
| `group` | modp2048s256 |
| `privateKey` | `0881382cdb87660c6dc13e614938d5b9c8b2f248581cc5e31b35454397fce50e` |
| `input` | _(empty)_ |
| `expected` | `2e9380c8323af97545bc4941deb0ec37 42c62fe0ece824a6abdbe66c59bee024 2911bfb967235ceba35ae13e4ec752be 630b92dc4bde2847a9c62cb815274542 1fb7eb60a63c0fe9159fcce726ce7cd8 523d7450667ef840e4919121eb5f01c8 c9b0d3d648a93bfb75689e8244ac134a f544711ce79a02dcc34226684780dddc b498594106c37f5bc79856487af5ab02 2a2e5e42f09897c1a85a11ea0212af04 d9b4cebc937c3c1a3e15a8a0342e3376 15c84e7fe3b8b9b87fb1e73a15af12a3 0d746e06dfc34f290d797ce51aa13aa7 85bf6658aff5e4b093003cbeaf665b3c 2e113a3a4e905269341dc0711426685f 4ef37e868a8126ff3f2279b57ca67e29` |

**Vector 12** — [RFC 5114 Appendix A.3 - 2048-bit MODP Group with 256-bit Prime Order Subgroup - party B public value yB from private exponent xB](https://www.rfc-editor.org/rfc/rfc5114#appendix-A.3)

| Field | Value |
| --- | --- |
| `group` | modp2048s256 |
| `privateKey` | `7d62a7e3ef36de617b13d1afb82c780d83a23bd4ee6705645121f371f546a53d` |
| `input` | _(empty)_ |
| `expected` | `575f0351bd2b1b817448bdf87a6c362c 1e289d3903a30b9832c5741fa250363e 7acbc7f77f3dacbc1f131add8e03367e ff8fbbb3e1c5784424809b25afe4d226 2a1a6fd2fab64105ca30a674e07f7809 852088632fc049233791ad4edd083a97 8b883ee618bc5e0dd047415f2d95e683 cf14826b5fbe10d3ce41c6c120c78ab2 0008c698bf7f0bcab9d7f407bed0f43a fb2970f57f8d12043963e66ddd320d59 9ad9936c8f44137c08b180ec5e985ceb e186f3d549677e80607331ee17af3380 a725b0782317d7dd43f59d7af9568a9b b63a84d365f92244ed120988219302f4 2924c7ca90b89d24f71b0ab697823d7d eb1aff5b0e8e4a45d49f7f53757e1913` |

---

[← All algorithms](../README.md)
