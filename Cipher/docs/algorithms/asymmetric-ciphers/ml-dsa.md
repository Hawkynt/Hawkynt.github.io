# ML-DSA

> NIST FIPS 204 Module-Lattice-Based Digital Signature Algorithm, the standardised form of CRYSTALS-Dilithium. Shares its lattice core with the Dilithium registration in dilithium.js and adds the message pre-processing FIPS 204 defines over it: the context string of the pure interface, the HashML-DSA pre-hash variant across the twelve approved hash functions, and ExternalMu-ML-DSA. Signing the same message under the two registrations gives different signatures, because the round-3 scheme has no context string to bind.

## Properties

| Property | Value |
| --- | --- |
| Category | Asymmetric Ciphers |
| Sub-category | Post-Quantum Lattice-Based Signature |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Vadim Lyubashevsky, Leo Ducas, Eike Kiltz, Tancrede Lepoint, Peter Schwabe, Gregor Seiler, Damien Stehle |
| Year | 2024 |
| Origin | 🌐 International |
| Source | [`algorithms/asymmetric/ml-dsa.js`](../../../algorithms/asymmetric/ml-dsa.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 44 bytes (352 bits); 65 bytes (520 bits); 87 bytes (696 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [NIST FIPS 204](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.204.pdf)
- [CRYSTALS-Dilithium Original Paper](https://eprint.iacr.org/2017/633)
- [NIST Post-Quantum Cryptography](https://csrc.nist.gov/projects/post-quantum-cryptography)
- [Module Learning With Errors](https://en.wikipedia.org/wiki/Learning_with_errors)

## References

- [NIST ACVP FIPS 204 Vectors](https://github.com/usnistgov/ACVP-Server/tree/master/gen-val/json-files)
- [CRYSTALS-Dilithium Reference Implementation](https://github.com/pq-crystals/dilithium)
- [NIST PQC Standardization](https://csrc.nist.gov/projects/post-quantum-cryptography/post-quantum-cryptography-standardization)
- [Lattice-Based Cryptography](https://en.wikipedia.org/wiki/Lattice-based_cryptography)

## Test vectors

16 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [ACVP ML-DSA-keyGen-FIPS204, ML-DSA-44 tcId 3: seed to public key](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/ML-DSA-keyGen-FIPS204/internalProjection.json)

| Field | Value |
| --- | --- |
| `parameterSet` | ML-DSA-44 |
| `keyGeneration` | Yes |
| `keyGenerationOutput` | publicKey |
| `keySeed` | `2aa7609556919cce9893561bb4120cdd9cff12734267a8ccb4b2d2ca93066e1e` |
| `input` | _(empty)_ |
| `expected` | `4e10efdcd5085de19c10dce5cb6dcb32 02200f21b5ae370eb8f8102b23380e13 2750162450c129419ea1c773aa5f4273 b9128d38b7e1c4acad6cf90dc99b6700 …` (1312 bytes; the full value is in the source) |

**Vector 2** — [ACVP ML-DSA-keyGen-FIPS204, ML-DSA-65 tcId 31: seed to private key](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/ML-DSA-keyGen-FIPS204/internalProjection.json)

| Field | Value |
| --- | --- |
| `parameterSet` | ML-DSA-65 |
| `keyGeneration` | Yes |
| `keyGenerationOutput` | privateKey |
| `keySeed` | `3caf99a3e33b5bf5bf133760dcb35e79d7c7f542126da7a8e50f1f8ee32eafd4` |
| `input` | _(empty)_ |
| `expected` | `bb0860b4531ed54ab6b4ef0ac214ad94 755e327d50cf94ec7900e92e8af50ea4 eefb77007a7b0babf594f7426382888b 45aa501ff2444f2aebb0ad3ff0c6a436 …` (4032 bytes; the full value is in the source) |

**Vector 3** — [ACVP ML-DSA-keyGen-FIPS204, ML-DSA-87 tcId 55: seed to public key](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/ML-DSA-keyGen-FIPS204/internalProjection.json)

| Field | Value |
| --- | --- |
| `parameterSet` | ML-DSA-87 |
| `keyGeneration` | Yes |
| `keyGenerationOutput` | publicKey |
| `keySeed` | `ec7cf913761b6a95c56b961b6a381e874f3cdaae96c16d9308bfe77e14a053ad` |
| `input` | _(empty)_ |
| `expected` | `41b3a3b97ef9278b4d3dcb0e1161028d 123f0fb39ae7a3d597c618356b97e865 698fe77f2cbda6cae987d7637d92b78b 05bb9c1844e9d0d28609238fb196798c …` (2592 bytes; the full value is in the source) |

**Vector 4** — [ACVP ML-DSA-sigGen-FIPS204, ML-DSA-65 tcId 41: pure external interface with a context string](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/ML-DSA-sigGen-FIPS204/internalProjection.json)

| Field | Value |
| --- | --- |
| `parameterSet` | ML-DSA-65 |
| `privateKey` | `1c58bf616a1ae7f41b90aff2076c9bfe 8fabc486e1ab01feddf1ed6baf62f8ca 2f785c328d7b1d381d56ba4d015bdeec d9d4959959e443ca74e96d9649a60874 …` (4032 bytes; the full value is in the source) |
| `messageEncoding` | pure |
| `context` | `73bdbbaa6d36302b2115c5` |
| `input` | `22` |
| `expected` | `8ba7a09349b56fc621456a987b7eb89d 82dfc29ee2e3ddaac95e15feb3b7a27d 73e4de24900be58917edab90a372f8ba d8eff4846cca8ccad6325a9e2fbb7321 …` (3309 bytes; the full value is in the source) |

**Vector 5** — [ACVP ML-DSA-sigGen-FIPS204, ML-DSA-65 tcId 57: pre-hash HashML-DSA with SHA2-256, the default pre-hash function](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/ML-DSA-sigGen-FIPS204/internalProjection.json)

| Field | Value |
| --- | --- |
| `parameterSet` | ML-DSA-65 |
| `privateKey` | `7e07c63675d6ab3bd283437f9c12e989 206a671fd30583135ea32288e3ef3079 ae912c7c501d1d8f662bfe18b976c7b7 6d1c1950bd4fb7913c1f7563586b33f8 …` (4032 bytes; the full value is in the source) |
| `messageEncoding` | preHash |
| `preHashAlgorithm` | SHA2-256 |
| `context` | `54f5ed135f57ca045ee3c0e95c6f09e3 9af29e54349fc29443e488af1ad7efeb 7a1772557d7d5163cb03feeea888ca52 c524e2b9ec86d4c74a6a91b1ba95085d d2697127c2cf087dab8bdb09660cffd4 9543452234c154ec3f352485fbfdefa6 0c65fba75d60950b47177a417214fc6e f08caea93b14` |
| `input` | `30747afaeee7b67e1651b17684d20f47 f46864a33354306f25b75e4e3cbad43e f494dcb674d0f3d16a5027959f6444a1 f8cae7afa4c2380c2aefcae1b820ce3d e751dbc8740711db1709656b615a5ff0 99166f0af8bb8fcf5c50bd86ac0bdad0 bc88f0ff54` |
| `expected` | `9e74f88a20a00c22feb9f930604574a0 a987b794d596d981360edfcfe402a75a d6b4aca758a53087c594306bca7dd707 1b2e94e7bfb4fd3c22c6049bf204c684 …` (3309 bytes; the full value is in the source) |

**Vector 6** — [ACVP ML-DSA-sigGen-FIPS204, ML-DSA-65 tcId 53: pre-hash HashML-DSA with SHA2-224](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/ML-DSA-sigGen-FIPS204/internalProjection.json)

| Field | Value |
| --- | --- |
| `parameterSet` | ML-DSA-65 |
| `privateKey` | `4c867431e3966f84a4acf5fbc18030d7 8ed11f6b14e26af1f6e6b90eeab74677 3f6475f9c0512de41f49b323cbf1bb4e dc8eb664ca54221144962895e4047922 …` (4032 bytes; the full value is in the source) |
| `messageEncoding` | preHash |
| `preHashAlgorithm` | SHA2-224 |
| `context` | `2d30d1b57d0b5860d5a387bc05da4e` |
| `input` | `1f` |
| `expected` | `34a6c95ea4c379c00e8aa658bd70a2e0 07fac2be128b1a35797d75cca3931cec 2333765f73aa3822327944b715af8b2b 15c52933370c47711bfc22f8c1459926 …` (3309 bytes; the full value is in the source) |

**Vector 7** — [ACVP ML-DSA-sigGen-FIPS204, ML-DSA-65 tcId 60: pre-hash HashML-DSA with SHAKE-128, the extendable-output branch](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/ML-DSA-sigGen-FIPS204/internalProjection.json)

| Field | Value |
| --- | --- |
| `parameterSet` | ML-DSA-65 |
| `privateKey` | `f5e7f1e98321eee5621b075dc62940be 43d0f4adcd189996f8c60aa39ea0f9b3 5a1d2d1d13c0e67ffdb1ff67e6b2f361 22377667fb2b5b2a4d28032d5443f5ed …` (4032 bytes; the full value is in the source) |
| `messageEncoding` | preHash |
| `preHashAlgorithm` | SHAKE-128 |
| `context` | `84d74fdc8312786c1c2a477b3cc47bcd 107dc0706d634e5765b268d7ebb42173 d24fd634d2eb78977e20f7f6c11a0f58 4e42fe4ff6e8fc5b0b21c8fba9f78d13 2108954c1dca100fccb6596abe5a792d ae12cf78c7427c679bf4ffe3fb454ed8 8bb6503a47bd6b1ebbc6917350974f0a 05c341f8cf18c97142dc0988e8cbd55e 2aaa020e647ef1ef0b9e9191b4be44a4 7ce7aed0a478828dc4b4b839ad76bc4c 574631953cccf2b494e57151a58e26fa 16b6fea5182da45b3f3eda573285d57c ef371fdab95a5b7b8dc7fe49d4c1cc9e 0cebbe82f3ac837720ebef98477f7b92 2e4512712d32e6d439f1519ba5c5462e d6` |
| `input` | `231eda5414df2b0e03ec3da696192525 c7d9b3ea0052a9f981c93e0945404d40 bb842fa5d08681b3b26b467a47849f74 969481704579c053c3abda9693de7a49 66852b368dbcba494af864c0a56da55b 5fd1e8bf8ab3c6e7ba` |
| `expected` | `d011ad49d149b68253a63b8e22b7278b 81528920d93ece2ae38219203a3e4e7e ebaf397e9a6d3bb9c27ba0df4a5778a5 9d58eaa5005e5edd148240b8897cd2b0 …` (3309 bytes; the full value is in the source) |

**Vector 8** — [ACVP ML-DSA-sigGen-FIPS204, ML-DSA-44 tcId 207: hedged pre-hash HashML-DSA with SHA3-384](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/ML-DSA-sigGen-FIPS204/internalProjection.json)

| Field | Value |
| --- | --- |
| `parameterSet` | ML-DSA-44 |
| `privateKey` | `045261b7868c4a2367f37d5cbdd41a54 5581bd022f50da4eacd48d4c7dc35eea 38b8e66f0c07484b5118f560ab457087 63e9acfead683436fb6bae3cc6591f6a …` (2560 bytes; the full value is in the source) |
| `messageEncoding` | preHash |
| `preHashAlgorithm` | SHA3-384 |
| `context` | `ecb807b3741d03535a618e53a8735882e351ffe422133db897b3973b1e2964` |
| `signRandomness` | `b1e33e7938cace03b84d8cd857e3dc268efd63e2fc6563036c2207840847e667` |
| `input` | `4d` |
| `expected` | `3d88f26d4100c2186fdd6e81f0322110 a2963561fbba042c1e9161ce6a71d267 5ee584567d83dc2ee4e2af003ac2d396 b56e6cac5b679532f26627535e8ee299 …` (2420 bytes; the full value is in the source) |

**Vector 9** — [ACVP ML-DSA-sigGen-FIPS204, ML-DSA-44 tcId 91: ExternalMu-ML-DSA, deterministic](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/ML-DSA-sigGen-FIPS204/internalProjection.json)

| Field | Value |
| --- | --- |
| `parameterSet` | ML-DSA-44 |
| `privateKey` | `6beb6817bdef24413265898baeab86c9 4bf2fa5533ccfc0c0d42e92f34b5e7b5 aaa3e9c5f83e71b3a69c77ffd8802d23 ca07a53eedc12560cee54f317c9247e4 …` (2560 bytes; the full value is in the source) |
| `messageEncoding` | externalMu |
| `input` | `3e240aef582154f8ab1879a5b6e0dc69 a5a214da86ba5585b4268c68b5449a81 e20b8a8cbad23e37ee42c9e51a4892d7 6859143fa70b51c9b0c4c19758433a74` |
| `expected` | `3327aa270451d3e5aaa3e1e27a841413 8d9270c1b44710f249693b205f890350 c970bc577e0d2e9ffe641147a7e877ca 86d6b31c64a8d80b9cb55a3fb1ee6c09 …` (2420 bytes; the full value is in the source) |

**Vector 10** — [ACVP ML-DSA-sigGen-FIPS204, ML-DSA-87 tcId 331: ExternalMu-ML-DSA, hedged](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/ML-DSA-sigGen-FIPS204/internalProjection.json)

| Field | Value |
| --- | --- |
| `parameterSet` | ML-DSA-87 |
| `privateKey` | `4b6ce73916e642641a4f515bac5c66d2 587a570af8d2044270d54ef27d2c847a 9c232b0605c2af78cc3c05bd9f9dedce 35f8bd9f0eade9418637a71334ffc3d8 …` (4896 bytes; the full value is in the source) |
| `messageEncoding` | externalMu |
| `signRandomness` | `5b000ae26e572ca3a70c0b142224e75a8531eed4a2ca48f0b0e4013447203401` |
| `input` | `1cf7a0f0d4abdb6f8200de6b356b82f4 6cf3677da321befbf0df8e49c7afa486 78407fa519534eedae92f661c539d03e 2ec9e3eba6ac429c9cb9442398890279` |
| `expected` | `612b292c10779a6fd1d1414a8dc3a3a1 add4b13fb18ea56d479a3e10733cc018 f3ba25994127d2b84ab1936e9e0a7cd3 3adfaeb76be5b039b9199c6f915c296c …` (4627 bytes; the full value is in the source) |

**Vector 11** — [ACVP ML-DSA-sigVer-FIPS204, ML-DSA-44 tcId 91: ExternalMu-ML-DSA, valid signature](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/ML-DSA-sigVer-FIPS204/internalProjection.json)

| Field | Value |
| --- | --- |
| `parameterSet` | ML-DSA-44 |
| `publicKey` | `e1b71cdbe81759a71fb5c07eea2d8747 c39c11a3c827c0462129375e1bd28655 647223f5ea75ed03344595005e132120 257ff6fc08e5c0523552c17af360bf31 …` (1312 bytes; the full value is in the source) |
| `signature` | `999eb21f38ca9c1f650ab3fe7875386b ceff90f4ad0d20ce1cd6356a3c434406 48201495551937bc7c5700c3b2bb1249 3f3b2f1f8671713b10db1cd1abf8e876 …` (2420 bytes; the full value is in the source) |
| `messageEncoding` | externalMu |
| `input` | `05c1c1aec158f8d500689056909d08cc 28a4702d2988052cdf9bfa60770fe6d7 00ac21564ef95e73fd0fc4f1bd41955e bafd73e327c5d6271710a720cbf5e4c4` |
| `expected` | `01` |

**Vector 12** — [ACVP ML-DSA-sigVer-FIPS204, ML-DSA-44 tcId 92: ExternalMu-ML-DSA, modified signature - z, must not verify](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/ML-DSA-sigVer-FIPS204/internalProjection.json)

| Field | Value |
| --- | --- |
| `parameterSet` | ML-DSA-44 |
| `publicKey` | `9a2334020aa332d36620d0be264cf0b5 9324672c0bd6fbcc62e5a0bcb43a096e 9cd1c94eff1a2ba847d2dd322472a3e3 d1334c1e645813ad1797683f92e0519b …` (1312 bytes; the full value is in the source) |
| `signature` | `5f017e3d156802cb51c588eec2189ce5 137ceb4440fcf6e363fd890b685f8e89 bb1513a837e4780b78c0c63ee7f1bf7a 4b1f071a71ff917887c723fb3b7733e4 …` (2420 bytes; the full value is in the source) |
| `messageEncoding` | externalMu |
| `input` | `b020b8ed9be2002da798ec857e222928 4b7c95196517e52491ebcd4706399365 8a0ba5f3925a2f6fbbe603e65e8cc01f e7a14acb38e75455144b48ca52bc14ab` |
| `expected` | `00` |

**Vector 13** — [ACVP ML-DSA-sigVer-FIPS204, ML-DSA-65 tcId 123: ExternalMu-ML-DSA, modified signature - commitment, must not verify](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/ML-DSA-sigVer-FIPS204/internalProjection.json)

| Field | Value |
| --- | --- |
| `parameterSet` | ML-DSA-65 |
| `publicKey` | `214e637c13e8942277657919228d774a f099689a6812a73cb591174266113c60 a255d9f9f98d558bdd98f690a0003323 2b8e40e5a95169c0c963a8f08d7d99a1 …` (1952 bytes; the full value is in the source) |
| `signature` | `1577fc90d03a6e86f2524b79b3980b67 81cdf7b6fe11c0dda2c35bffdd9ac062 9ae1e96671c811f2c0742c8cb39203c3 d88d4afdfe139b897c7f48fab7080688 …` (3309 bytes; the full value is in the source) |
| `messageEncoding` | externalMu |
| `input` | `bac652225dcaa2000a402f96b1a9626c 14a1db8ce9cb530d2232e66ef86036ae 08da5adcdf51b9df89c6723704b014f4 616de4bfedaba815a3317316aa2cc67c` |
| `expected` | `00` |

**Vector 14** — [ACVP ML-DSA-sigVer-FIPS204, ML-DSA-44 tcId 25: pre-hash HashML-DSA with SHA2-224, valid signature](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/ML-DSA-sigVer-FIPS204/internalProjection.json)

| Field | Value |
| --- | --- |
| `parameterSet` | ML-DSA-44 |
| `publicKey` | `9c35ca842c84890c72efb32e44afa4fe e29638f0f7ff5556aef7463a8378496f 6aea5927fca189d0b4a1f1405fd9c6d3 a934e94c57f4068cb216836acd7edadf …` (1312 bytes; the full value is in the source) |
| `signature` | `13de2bb147539d287e66dc9b00c4f47f 2c2f33a4faa256ecefb937ef07e033ff a358acc69a03554a1771d72c53e476cb ee5fa7f2e3b921df292c50f2014df2f1 …` (2420 bytes; the full value is in the source) |
| `messageEncoding` | preHash |
| `preHashAlgorithm` | SHA2-224 |
| `context` | `15544868628de6010ecbd5ebe532f0dd 92a036b58ad428b8d246347f5622cf7c c440322ec39339a07193bbc4fc09af3d e4de` |
| `input` | `d3` |
| `expected` | `01` |

**Vector 15** — [ACVP ML-DSA-sigVer-FIPS204, ML-DSA-44 tcId 9: pure external interface, modified signature - hint, must not verify](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/ML-DSA-sigVer-FIPS204/internalProjection.json)

| Field | Value |
| --- | --- |
| `parameterSet` | ML-DSA-44 |
| `publicKey` | `3dbea11df7cf760d20f25d250da2ed66 4679bc5f8cfe1ab246d0d975960de334 3d1901a67fc48a6fb775594c971ea2a7 9dab578fda41ad235c550974f7428924 …` (1312 bytes; the full value is in the source) |
| `signature` | `c0162f0ea7a5e7de9282105e964c3502 ecdf05d94974f6506393c3dec22b98b2 64d74ac50bed39e1f75d54c841ca2ef3 ea6978c6e15637e44126242738242f4d …` (2420 bytes; the full value is in the source) |
| `messageEncoding` | pure |
| `context` | `89b1280b39e807` |
| `input` | `3f` |
| `expected` | `00` |

**Vector 16** — [ACVP ML-DSA-sigVer-FIPS204: tcId 25's valid signature under tcId 9's public key must not verify](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/ML-DSA-sigVer-FIPS204/internalProjection.json)

| Field | Value |
| --- | --- |
| `parameterSet` | ML-DSA-44 |
| `publicKey` | `3dbea11df7cf760d20f25d250da2ed66 4679bc5f8cfe1ab246d0d975960de334 3d1901a67fc48a6fb775594c971ea2a7 9dab578fda41ad235c550974f7428924 …` (1312 bytes; the full value is in the source) |
| `signature` | `13de2bb147539d287e66dc9b00c4f47f 2c2f33a4faa256ecefb937ef07e033ff a358acc69a03554a1771d72c53e476cb ee5fa7f2e3b921df292c50f2014df2f1 …` (2420 bytes; the full value is in the source) |
| `messageEncoding` | preHash |
| `preHashAlgorithm` | SHA2-224 |
| `context` | `15544868628de6010ecbd5ebe532f0dd 92a036b58ad428b8d246347f5622cf7c c440322ec39339a07193bbc4fc09af3d e4de` |
| `input` | `d3` |
| `expected` | `00` |

---

[← All algorithms](../README.md)
