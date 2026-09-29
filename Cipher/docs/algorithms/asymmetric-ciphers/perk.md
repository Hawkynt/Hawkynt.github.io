# PERK

> Digital signature scheme submitted to the NIST additional signatures project, proving knowledge of a permutation that solves an instance of the Permuted Kernel Problem over F_1021. The proof is MPC-in-the-Head: each round splits the secret permutation into N shares, commits to all of them and opens all but one. Version 2.0.0, all twelve parameter sets, verified against the submission Known Answer Tests.

## Properties

| Property | Value |
| --- | --- |
| Category | Asymmetric Ciphers |
| Sub-category | Post-Quantum Digital Signature |
| Security status | 🧪 Experimental |
| Complexity | Expert |
| Inventor | Najwa Aaraj, Slim Bettaieb, Loic Bidoux, Alessandro Budroni, Victor Dyseryn, Andre Esser, Thibauld Feneuil, Philippe Gaborit, Mukul Kulkarni, Victor Mateu, Marco Palumbi, Lucas Perin, Matthieu Rivain, Jean-Pierre Tillich, Keita Xagawa |
| Year | 2023 |
| Origin | 🌐 International |
| Source | [`algorithms/asymmetric/perk.js`](../../../algorithms/asymmetric/perk.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 164 bytes (1312 bits); 257 bytes (2056 bits) |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [PERK specification and submission package](https://pqc-perk.org/resources.html)
- [NIST additional signatures project](https://csrc.nist.gov/projects/pqc-dig-sig)
- [PERK: compact signature scheme based on a new variant of the permuted kernel problem](https://eprint.iacr.org/2024/748)

## References

- [PERK project page](https://pqc-perk.org/)
- [The permuted kernel problem (Shamir, CRYPTO 1989)](https://link.springer.com/chapter/10.1007/0-387-34805-0_54)

## Test vectors

20 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [PERK PQCsignKAT_164.rsp record 0: drawn seeds to public key (perk-128-fast-3)](https://pqc-perk.org/assets/downloads/perk-v2.0.0.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | perk-128-fast-3 |
| `keyGenerationOutput` | publicKey |
| `input` | `7c9935a0b07694aa0c6d10e4db6b1add91282214654cb55e7c2cacd53919604d` |
| `expected` | `7c9935a0b07694aa0c6d10e4db6b1add ab066e720db3a9df62ad80c8f24bfe90 40aca485c56c4a0b4e71733c44bd4782 887d601d57de29d6c8a8f7c7caf17707 7a11bb3f14024390b448632bafaa0f1f 86aebda57b7a703c83260265118735e7 9dab33649e9199b5d187c02435c69db3 6918ef7de373c0a5451c86b901b88464 8010499d95b9802d7acb2e53cef16e7c fe7db001` |

**Vector 2** — [PERK PQCsignKAT_164.rsp record 0: drawn seeds to private key (perk-128-fast-3)](https://pqc-perk.org/assets/downloads/perk-v2.0.0.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | perk-128-fast-3 |
| `keyGenerationOutput` | privateKey |
| `input` | `7c9935a0b07694aa0c6d10e4db6b1add91282214654cb55e7c2cacd53919604d` |
| `expected` | `91282214654cb55e7c2cacd53919604d 7c9935a0b07694aa0c6d10e4db6b1add ab066e720db3a9df62ad80c8f24bfe90 40aca485c56c4a0b4e71733c44bd4782 887d601d57de29d6c8a8f7c7caf17707 7a11bb3f14024390b448632bafaa0f1f 86aebda57b7a703c83260265118735e7 9dab33649e9199b5d187c02435c69db3 6918ef7de373c0a5451c86b901b88464 8010499d95b9802d7acb2e53cef16e7c fe7db001` |

**Vector 3** — [PERK PQCsignKAT_164.rsp record 0: the published signed message (perk-128-fast-3)](https://pqc-perk.org/assets/downloads/perk-v2.0.0.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | perk-128-fast-3 |
| `privateKey` | `91282214654cb55e7c2cacd53919604d 7c9935a0b07694aa0c6d10e4db6b1add ab066e720db3a9df62ad80c8f24bfe90 40aca485c56c4a0b4e71733c44bd4782 887d601d57de29d6c8a8f7c7caf17707 7a11bb3f14024390b448632bafaa0f1f 86aebda57b7a703c83260265118735e7 9dab33649e9199b5d187c02435c69db3 6918ef7de373c0a5451c86b901b88464 8010499d95b9802d7acb2e53cef16e7c fe7db001` |
| `signingRandomness` | `4249e0458b874d2cf0ee707de4068e75 f217bb8e877219832dfcedf6ab029ae7 d0b4e078d60d8467d1884563ccfd66d8` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `f217bb8e877219832dfcedf6ab029ae7 d0b4e078d60d8467d1884563ccfd66d8 c09c9219a82fa6f896d0e9ddeb0d7e27 6418a3bd9af3d904cd8f520023b040a5 …` (8378 bytes; the full value is in the source) |

**Vector 4** — [PERK PQCsignKAT_164.rsp record 0: the published signature verifies (perk-128-fast-3)](https://pqc-perk.org/assets/downloads/perk-v2.0.0.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | perk-128-fast-3 |
| `publicKey` | `7c9935a0b07694aa0c6d10e4db6b1add ab066e720db3a9df62ad80c8f24bfe90 40aca485c56c4a0b4e71733c44bd4782 887d601d57de29d6c8a8f7c7caf17707 7a11bb3f14024390b448632bafaa0f1f 86aebda57b7a703c83260265118735e7 9dab33649e9199b5d187c02435c69db3 6918ef7de373c0a5451c86b901b88464 8010499d95b9802d7acb2e53cef16e7c fe7db001` |
| `signature` | `f217bb8e877219832dfcedf6ab029ae7 d0b4e078d60d8467d1884563ccfd66d8 c09c9219a82fa6f896d0e9ddeb0d7e27 6418a3bd9af3d904cd8f520023b040a5 …` (8345 bytes; the full value is in the source) |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `01` |

**Vector 5** — [PERK PQCsignKAT_164.rsp record 0: one bit of the message flipped must not verify](https://pqc-perk.org/assets/downloads/perk-v2.0.0.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | perk-128-fast-3 |
| `publicKey` | `7c9935a0b07694aa0c6d10e4db6b1add ab066e720db3a9df62ad80c8f24bfe90 40aca485c56c4a0b4e71733c44bd4782 887d601d57de29d6c8a8f7c7caf17707 7a11bb3f14024390b448632bafaa0f1f 86aebda57b7a703c83260265118735e7 9dab33649e9199b5d187c02435c69db3 6918ef7de373c0a5451c86b901b88464 8010499d95b9802d7acb2e53cef16e7c fe7db001` |
| `signature` | `f217bb8e877219832dfcedf6ab029ae7 d0b4e078d60d8467d1884563ccfd66d8 c09c9219a82fa6f896d0e9ddeb0d7e27 6418a3bd9af3d904cd8f520023b040a5 …` (8345 bytes; the full value is in the source) |
| `input` | `d81c4d8d734fcbfaeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `00` |

**Vector 6** — [PERK PQCsignKAT_164.rsp record 0: one bit of the opened share must not verify](https://pqc-perk.org/assets/downloads/perk-v2.0.0.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | perk-128-fast-3 |
| `publicKey` | `7c9935a0b07694aa0c6d10e4db6b1add ab066e720db3a9df62ad80c8f24bfe90 40aca485c56c4a0b4e71733c44bd4782 887d601d57de29d6c8a8f7c7caf17707 7a11bb3f14024390b448632bafaa0f1f 86aebda57b7a703c83260265118735e7 9dab33649e9199b5d187c02435c69db3 6918ef7de373c0a5451c86b901b88464 8010499d95b9802d7acb2e53cef16e7c fe7db001` |
| `signature` | `f217bb8e877219832dfcedf6ab029ae7 d0b4e078d60d8467d1884563ccfd66d8 c09c9219a82fa6f896d0e9ddeb0d7e27 6418a3bd9af3d904cd8f520023b040a5 …` (8345 bytes; the full value is in the source) |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `00` |

**Vector 7** — [PERK PQCsignKAT_164.rsp: record 0's signature must not verify under record 1's public key](https://pqc-perk.org/assets/downloads/perk-v2.0.0.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | perk-128-fast-3 |
| `publicKey` | `4b622de1350119c45a9f2e2ef3dc5df5 07f763d0e573cc275a30483c17ad2ef9 692b40593b0d87e2931812832c223c7f 0cd53b798c4d98e0c12a12e54129c8b0 ab4405ed448b1a5c1eae2d351281fe0a 8584da5ef8a06de853e472384c8e5916 cdcd17e2b966d18711cc3f5b55a960d7 180bb86f9f3525b2506a549f73377086 a097c8049851f1c0bc6b1b0d121506cc 10085c02` |
| `signature` | `f217bb8e877219832dfcedf6ab029ae7 d0b4e078d60d8467d1884563ccfd66d8 c09c9219a82fa6f896d0e9ddeb0d7e27 6418a3bd9af3d904cd8f520023b040a5 …` (8345 bytes; the full value is in the source) |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `00` |

**Vector 8** — [PERK PQCsignKAT_257.rsp record 0: drawn seeds to public key (perk-128-fast-5)](https://pqc-perk.org/assets/downloads/perk-v2.0.0.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | perk-128-fast-5 |
| `keyGenerationOutput` | publicKey |
| `input` | `7c9935a0b07694aa0c6d10e4db6b1add91282214654cb55e7c2cacd53919604d` |
| `expected` | `7c9935a0b07694aa0c6d10e4db6b1add 59bcff353c091f9c56165035e67cba7a 9a175c360357d2450bbbf2ce13133992 a2e8f6db40255fd97d0b5a4115cc6a1b 36b26b63afb32b4a1f97c996a920f163 3ded3d856c33b4378547545ff86264e6 f81d123dc49218367edf45d76f933a60 2df68cda3ff13fbc58ad246746c03cda b06ac518b22260e5f79f2ed12b3f39ea 4df8946a53ce4184f970bf66fbfd7824 574ee4090634a30126064b4858ef3773 438381ef847b61cf1717b2a326c50361 7c940e80f016995b04b7cb42351f4db7 df5a5dd655dc3cd90930bdee008f2293 c5a7c116f7d2e1b3785bc6383661ede8 b8` |

**Vector 9** — [PERK PQCsignKAT_257.rsp record 0: the published signature verifies (perk-128-fast-5)](https://pqc-perk.org/assets/downloads/perk-v2.0.0.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | perk-128-fast-5 |
| `publicKey` | `7c9935a0b07694aa0c6d10e4db6b1add 59bcff353c091f9c56165035e67cba7a 9a175c360357d2450bbbf2ce13133992 a2e8f6db40255fd97d0b5a4115cc6a1b 36b26b63afb32b4a1f97c996a920f163 3ded3d856c33b4378547545ff86264e6 f81d123dc49218367edf45d76f933a60 2df68cda3ff13fbc58ad246746c03cda b06ac518b22260e5f79f2ed12b3f39ea 4df8946a53ce4184f970bf66fbfd7824 574ee4090634a30126064b4858ef3773 438381ef847b61cf1717b2a326c50361 7c940e80f016995b04b7cb42351f4db7 df5a5dd655dc3cd90930bdee008f2293 c5a7c116f7d2e1b3785bc6383661ede8 b8` |
| `signature` | `f217bb8e877219832dfcedf6ab029ae7 d0b4e078d60d8467d1884563ccfd66d8 a8f57a24fe26180f7a4b690f7c381555 85a5a94ba7a7c1dcf738b9ed9c24d8d2 …` (8026 bytes; the full value is in the source) |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `01` |

**Vector 10** — [PERK PQCsignKAT_164.rsp record 0: drawn seeds to public key (perk-128-short-3)](https://pqc-perk.org/assets/downloads/perk-v2.0.0.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | perk-128-short-3 |
| `keyGenerationOutput` | publicKey |
| `input` | `7c9935a0b07694aa0c6d10e4db6b1add91282214654cb55e7c2cacd53919604d` |
| `expected` | `7c9935a0b07694aa0c6d10e4db6b1add ab066e720db3a9df62ad80c8f24bfe90 40aca485c56c4a0b4e71733c44bd4782 887d601d57de29d6c8a8f7c7caf17707 7a11bb3f14024390b448632bafaa0f1f 86aebda57b7a703c83260265118735e7 9dab33649e9199b5d187c02435c69db3 6918ef7de373c0a5451c86b901b88464 8010499d95b9802d7acb2e53cef16e7c fe7db001` |

**Vector 11** — [PERK PQCsignKAT_164.rsp record 0: the published signature verifies (perk-128-short-3)](https://pqc-perk.org/assets/downloads/perk-v2.0.0.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | perk-128-short-3 |
| `publicKey` | `7c9935a0b07694aa0c6d10e4db6b1add ab066e720db3a9df62ad80c8f24bfe90 40aca485c56c4a0b4e71733c44bd4782 887d601d57de29d6c8a8f7c7caf17707 7a11bb3f14024390b448632bafaa0f1f 86aebda57b7a703c83260265118735e7 9dab33649e9199b5d187c02435c69db3 6918ef7de373c0a5451c86b901b88464 8010499d95b9802d7acb2e53cef16e7c fe7db001` |
| `signature` | `f217bb8e877219832dfcedf6ab029ae7 d0b4e078d60d8467d1884563ccfd66d8 d80641754000787f27fc012140d5f870 5bc52514f6e33554a9c522a7bbc0b778 …` (6251 bytes; the full value is in the source) |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `01` |

**Vector 12** — [PERK PQCsignKAT_257.rsp record 0: drawn seeds to public key (perk-128-short-5)](https://pqc-perk.org/assets/downloads/perk-v2.0.0.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | perk-128-short-5 |
| `keyGenerationOutput` | publicKey |
| `input` | `7c9935a0b07694aa0c6d10e4db6b1add91282214654cb55e7c2cacd53919604d` |
| `expected` | `7c9935a0b07694aa0c6d10e4db6b1add 59bcff353c091f9c56165035e67cba7a 9a175c360357d2450bbbf2ce13133992 a2e8f6db40255fd97d0b5a4115cc6a1b 36b26b63afb32b4a1f97c996a920f163 3ded3d856c33b4378547545ff86264e6 f81d123dc49218367edf45d76f933a60 2df68cda3ff13fbc58ad246746c03cda b06ac518b22260e5f79f2ed12b3f39ea 4df8946a53ce4184f970bf66fbfd7824 574ee4090634a30126064b4858ef3773 438381ef847b61cf1717b2a326c50361 7c940e80f016995b04b7cb42351f4db7 df5a5dd655dc3cd90930bdee008f2293 c5a7c116f7d2e1b3785bc6383661ede8 b8` |

**Vector 13** — [PERK PQCsignKAT_251.rsp record 0: drawn seeds to public key (perk-192-fast-3)](https://pqc-perk.org/assets/downloads/perk-v2.0.0.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | perk-192-fast-3 |
| `keyGenerationOutput` | publicKey |
| `input` | `7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148038626ed79d4511408 00e03b59b956f8210e556067407d13dc` |
| `expected` | `7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb14803e92380f3dc00284e 8067c4bb0a24fd733cbf502f9b338a4a 8c1ea4dee6924452b526b061e87ecc0c 0a8c8a67627f319b536ded4051cf5308 319c8d5df3149306d5f77d7defc48633 02ce71685bc990c92ef73df7009794f3 63188b23967715d29ac7aa2902dcfa12 e496ac605ca8f9e1f8543a472eada917 e9b30d5d3dc12093d1296b258e499bc2 4730526efa138a30d73fe3e817319ee6 8fbfad4f878dc9f776b3b6026c3909f0 7ed186ab2545e890afa492a0ef1e5ddd 8f2e267bc105021d083332c1de51af6f c8770c` |

**Vector 14** — [PERK PQCsignKAT_392.rsp record 0: drawn seeds to public key (perk-192-fast-5)](https://pqc-perk.org/assets/downloads/perk-v2.0.0.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | perk-192-fast-5 |
| `keyGenerationOutput` | publicKey |
| `input` | `7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148038626ed79d4511408 00e03b59b956f8210e556067407d13dc` |
| `expected` | `7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb14803f73f0ebaca010920 2ec4211bd22c6c6f84c6b1c28b523113 afbbc29e7abd514fce33572eb295e0f4 …` (368 bytes; the full value is in the source) |

**Vector 15** — [PERK PQCsignKAT_251.rsp record 0: drawn seeds to public key (perk-192-short-3)](https://pqc-perk.org/assets/downloads/perk-v2.0.0.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | perk-192-short-3 |
| `keyGenerationOutput` | publicKey |
| `input` | `7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148038626ed79d4511408 00e03b59b956f8210e556067407d13dc` |
| `expected` | `7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb14803e92380f3dc00284e 8067c4bb0a24fd733cbf502f9b338a4a 8c1ea4dee6924452b526b061e87ecc0c 0a8c8a67627f319b536ded4051cf5308 319c8d5df3149306d5f77d7defc48633 02ce71685bc990c92ef73df7009794f3 63188b23967715d29ac7aa2902dcfa12 e496ac605ca8f9e1f8543a472eada917 e9b30d5d3dc12093d1296b258e499bc2 4730526efa138a30d73fe3e817319ee6 8fbfad4f878dc9f776b3b6026c3909f0 7ed186ab2545e890afa492a0ef1e5ddd 8f2e267bc105021d083332c1de51af6f c8770c` |

**Vector 16** — [PERK PQCsignKAT_392.rsp record 0: drawn seeds to public key (perk-192-short-5)](https://pqc-perk.org/assets/downloads/perk-v2.0.0.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | perk-192-short-5 |
| `keyGenerationOutput` | publicKey |
| `input` | `7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148038626ed79d4511408 00e03b59b956f8210e556067407d13dc` |
| `expected` | `7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb14803f73f0ebaca010920 2ec4211bd22c6c6f84c6b1c28b523113 afbbc29e7abd514fce33572eb295e0f4 …` (368 bytes; the full value is in the source) |

**Vector 17** — [PERK PQCsignKAT_346.rsp record 0: drawn seeds to public key (perk-256-fast-3)](https://pqc-perk.org/assets/downloads/perk-v2.0.0.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | perk-256-fast-3 |
| `keyGenerationOutput` | publicKey |
| `input` | `7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148032dcd739936737f2d 8626ed79d451140800e03b59b956f821 0e556067407d13dc90fa9e8b872bfb8f` |
| `expected` | `7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148032dcd739936737f2d 8a8e11fa43a9e54dc3a97b684df755ec a1fb75e272cf97bf5a663a8c961af7ef …` (314 bytes; the full value is in the source) |

**Vector 18** — [PERK PQCsignKAT_539.rsp record 0: drawn seeds to public key (perk-256-fast-5)](https://pqc-perk.org/assets/downloads/perk-v2.0.0.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | perk-256-fast-5 |
| `keyGenerationOutput` | publicKey |
| `input` | `7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148032dcd739936737f2d 8626ed79d451140800e03b59b956f821 0e556067407d13dc90fa9e8b872bfb8f` |
| `expected` | `7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148032dcd739936737f2d 52983c39c13e764e56329d2894e1b44e be4c20364e34a0e80aafb13ec47dd37c …` (507 bytes; the full value is in the source) |

**Vector 19** — [PERK PQCsignKAT_346.rsp record 0: drawn seeds to public key (perk-256-short-3)](https://pqc-perk.org/assets/downloads/perk-v2.0.0.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | perk-256-short-3 |
| `keyGenerationOutput` | publicKey |
| `input` | `7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148032dcd739936737f2d 8626ed79d451140800e03b59b956f821 0e556067407d13dc90fa9e8b872bfb8f` |
| `expected` | `7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148032dcd739936737f2d 8a8e11fa43a9e54dc3a97b684df755ec a1fb75e272cf97bf5a663a8c961af7ef …` (314 bytes; the full value is in the source) |

**Vector 20** — [PERK PQCsignKAT_539.rsp record 0: drawn seeds to public key (perk-256-short-5)](https://pqc-perk.org/assets/downloads/perk-v2.0.0.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | perk-256-short-5 |
| `keyGenerationOutput` | publicKey |
| `input` | `7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148032dcd739936737f2d 8626ed79d451140800e03b59b956f821 0e556067407d13dc90fa9e8b872bfb8f` |
| `expected` | `7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148032dcd739936737f2d 52983c39c13e764e56329d2894e1b44e be4c20364e34a0e80aafb13ec47dd37c …` (507 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
