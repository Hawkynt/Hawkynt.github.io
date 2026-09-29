# Classic McEliece

> Code-based key encapsulation submitted to round 4 of the NIST post-quantum process, and the oldest public key scheme still unbroken. The private key is a binary Goppa code - a monic irreducible polynomial of degree t over GF(2^m) and an ordering of the field - and the public key is that code's parity check matrix in systematic form, so a ciphertext is the syndrome of a weight-t error vector and decapsulation is Berlekamp decoding. Public keys are hundreds of kilobytes; ciphertexts are under two hundred bytes. All five systematic parameter sets are implemented and verified against the submission's own Known Answer Tests.

## Properties

| Property | Value |
| --- | --- |
| Category | Asymmetric Ciphers |
| Sub-category | Code-Based Post-Quantum KEM |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Robert J. McEliece; round 4 submission by Bernstein, Chou, Cid, Gilcher, Lange, Maram, von Maurich, Misoczki, Niederhagen, Paiva, Persichetti, Peters, Schwabe, Sendrier, Szefer, Tjhai, Tomlinson, Wang |
| Year | 1978 |
| Origin | 🌐 International |
| Source | [`algorithms/asymmetric/classic-mceliece.js`](../../../algorithms/asymmetric/classic-mceliece.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 6492 bytes (51936 bits); 13608 bytes (108864 bits); 13932 bytes (111456 bits); 13948 bytes (111584 bits); 14120 bytes (112960 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Key size rather than a break | No attack better than generic information set decoding is known against these parameter sets after four decades. The practical obstacle is the public key, which is 261 kilobytes at the smallest set and over a megabyte at the largest. | Use the parameter sets as published. Do not attempt to shrink the key by lowering t or n. |
| Key generation is not constant time here | This implementation sorts the field ordering and reduces the parity check matrix with data dependent branches, and rejects seeds by returning early. Timing a key generation could leak which seed was used. | Treat this as a reference implementation of the scheme rather than a hardened one. |

## Documentation

- [Classic McEliece specification (round 4)](https://classic.mceliece.org/mceliece-spec-20221023.pdf)
- [Classic McEliece round 4 submission](https://classic.mceliece.org/nist.html)
- [McEliece's original 1978 report](https://ipnpr.jpl.nasa.gov/progress_report2/42-44/44N.PDF)
- [Niederreiter's dual formulation](https://en.wikipedia.org/wiki/Niederreiter_cryptosystem)

## References

- [Round 4 Known Answer Tests](https://classic.mceliece.org/nist/mceliece-kat-20221023.tar.gz)
- [Round 4 submission package](https://classic.mceliece.org/nist/mceliece-20221023.tar.gz)
- [NIST Post-Quantum Cryptography project](https://csrc.nist.gov/projects/post-quantum-cryptography)
- [Binary Goppa codes](https://en.wikipedia.org/wiki/Goppa_code)

## Test vectors

12 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Classic McEliece mceliece348864 kat_kem.rsp record 0: the seed generates the published private key](https://classic.mceliece.org/nist/mceliece-kat-20221023.tar.gz)

| Field | Value |
| --- | --- |
| `parameterSet` | mceliece348864 |
| `keyGeneration` | Yes |
| `keyGenerationOutput` | privateKey |
| `input` | `061550234d158c5ec95595fe04ef7a25 767f2e24cc2bc479d09d86dc9abcfde7 056a8c266f9ef97ed08541dbd2e1ffa1` |
| `expected` | `5b815c890117893d8bb8e886f63a78ce 2d5f58342d703348cb95539e14b9a719 ffffffff00000000f7066e0e5103160e 7600fe0e0300c00f670a1a039a027b0b …` (6492 bytes; the full value is in the source) |

**Vector 2** — [Classic McEliece mceliece348864 kat_kem.rsp record 0: the seed generates the published ciphertext](https://classic.mceliece.org/nist/mceliece-kat-20221023.tar.gz)

| Field | Value |
| --- | --- |
| `parameterSet` | mceliece348864 |
| `katRecord` | Yes |
| `encapsulationOutput` | ciphertext |
| `input` | `061550234d158c5ec95595fe04ef7a25 767f2e24cc2bc479d09d86dc9abcfde7 056a8c266f9ef97ed08541dbd2e1ffa1` |
| `expected` | `def61908a70a3099e45b4d5d91957ade 70f571d210d525d655db7294515f91d9 7795f2353615bc7cdf13502181e5bcc8 c9abfef31819d66dd2760363694f7896 02264a3e24445681a0183ce343a2264f dff96c82ab318ae888d105d52d59bc1b` |

**Vector 3** — [Classic McEliece mceliece348864 kat_kem.rsp record 0: the seed generates the published shared secret](https://classic.mceliece.org/nist/mceliece-kat-20221023.tar.gz)

| Field | Value |
| --- | --- |
| `parameterSet` | mceliece348864 |
| `katRecord` | Yes |
| `encapsulationOutput` | sharedSecret |
| `input` | `061550234d158c5ec95595fe04ef7a25 767f2e24cc2bc479d09d86dc9abcfde7 056a8c266f9ef97ed08541dbd2e1ffa1` |
| `expected` | `b4f9ff1e4390e3be0bbcebff9a525ae83b191211896aa8786ce8bc511c9f78c3` |

**Vector 4** — [Classic McEliece mceliece348864 kat_kem.rsp record 0: decapsulation recovers the shared secret](https://classic.mceliece.org/nist/mceliece-kat-20221023.tar.gz)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `privateKey` | `5b815c890117893d8bb8e886f63a78ce 2d5f58342d703348cb95539e14b9a719 ffffffff00000000f7066e0e5103160e 7600fe0e0300c00f670a1a039a027b0b …` (6492 bytes; the full value is in the source) |
| `input` | `def61908a70a3099e45b4d5d91957ade 70f571d210d525d655db7294515f91d9 7795f2353615bc7cdf13502181e5bcc8 c9abfef31819d66dd2760363694f7896 02264a3e24445681a0183ce343a2264f dff96c82ab318ae888d105d52d59bc1b` |
| `expected` | `b4f9ff1e4390e3be0bbcebff9a525ae83b191211896aa8786ce8bc511c9f78c3` |

**Vector 5** — [Classic McEliece mceliece348864 kat_kem.rsp record 0: the recovered secret is the published one](https://classic.mceliece.org/nist/mceliece-kat-20221023.tar.gz)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `privateKey` | `5b815c890117893d8bb8e886f63a78ce 2d5f58342d703348cb95539e14b9a719 ffffffff00000000f7066e0e5103160e 7600fe0e0300c00f670a1a039a027b0b …` (6492 bytes; the full value is in the source) |
| `sharedSecret` | `b4f9ff1e4390e3be0bbcebff9a525ae83b191211896aa8786ce8bc511c9f78c3` |
| `input` | `def61908a70a3099e45b4d5d91957ade 70f571d210d525d655db7294515f91d9 7795f2353615bc7cdf13502181e5bcc8 c9abfef31819d66dd2760363694f7896 02264a3e24445681a0183ce343a2264f dff96c82ab318ae888d105d52d59bc1b` |
| `expected` | `01` |

**Vector 6** — [Classic McEliece mceliece348864: a modified ciphertext must not decapsulate to the published secret](https://classic.mceliece.org/nist/mceliece-kat-20221023.tar.gz)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `privateKey` | `5b815c890117893d8bb8e886f63a78ce 2d5f58342d703348cb95539e14b9a719 ffffffff00000000f7066e0e5103160e 7600fe0e0300c00f670a1a039a027b0b …` (6492 bytes; the full value is in the source) |
| `sharedSecret` | `b4f9ff1e4390e3be0bbcebff9a525ae83b191211896aa8786ce8bc511c9f78c3` |
| `input` | `dff61908a70a3099e45b4d5d91957ade 70f571d210d525d655db7294515f91d9 7795f2353615bc7cdf13502181e5bcc8 c9abfef31819d66dd2760363694f7896 02264a3e24445681a0183ce343a2264f dff96c82ab318ae888d105d52d59bc1b` |
| `expected` | `00` |

**Vector 7** — [Classic McEliece mceliece348864: record 0's ciphertext under record 1's private key must not recover record 0's secret](https://classic.mceliece.org/nist/mceliece-kat-20221023.tar.gz)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `privateKey` | `738e32ad8ae9e5e096273f288b206671 8b22b329b6119e5cd91647123b50a657 ffffffff000000006c064d0f20094e09 800de407480b280ce303ed081702680b …` (6492 bytes; the full value is in the source) |
| `sharedSecret` | `b4f9ff1e4390e3be0bbcebff9a525ae83b191211896aa8786ce8bc511c9f78c3` |
| `input` | `def61908a70a3099e45b4d5d91957ade 70f571d210d525d655db7294515f91d9 7795f2353615bc7cdf13502181e5bcc8 c9abfef31819d66dd2760363694f7896 02264a3e24445681a0183ce343a2264f dff96c82ab318ae888d105d52d59bc1b` |
| `expected` | `00` |

**Vector 8** — [Classic McEliece mceliece348864 kat_kem.rsp record 1: decapsulation recovers the shared secret](https://classic.mceliece.org/nist/mceliece-kat-20221023.tar.gz)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `privateKey` | `738e32ad8ae9e5e096273f288b206671 8b22b329b6119e5cd91647123b50a657 ffffffff000000006c064d0f20094e09 800de407480b280ce303ed081702680b …` (6492 bytes; the full value is in the source) |
| `input` | `a5137a52d79e86cd997fef78044bbeb2 1da57e32ffb02203549757fd7d056fa8 c66cf8e7d311f34c67afde7db9a41385 d6ccff7342a772bfcfa0f2921e913c8f 1a5af5c10ec33a2144938b5ec9863b2b 8219d98763fc1778b733e6b2f577ac0e` |
| `expected` | `6a6694846bbec86323d49a3a44daecf33889bc705a1890973831a1738bf3cff4` |

**Vector 9** — [Classic McEliece mceliece460896 kat_kem.rsp record 0: decapsulation recovers the shared secret](https://classic.mceliece.org/nist/mceliece-kat-20221023.tar.gz)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `privateKey` | `767e46d32bf28588a814ef76821455d0 0f29c723a6971d392b269626131fd97c ffffffff00000000a9002c0c2a1fdb12 e407fe11591d5d05c002a80748147d08 …` (13608 bytes; the full value is in the source) |
| `input` | `cf78c42a38795e0f5d6bac38acdee6c4 c9536f93bcc32e08b8ce0b886e737aa5 ad51cc0e2e5b9176b67f0327ea117334 dcd5664adcffb39f1932c498b210a56e b5c9e9c7c5db03dc46c5d2450d1f05c1 52533be30aa544f20ff11cac1ffebb91 9d69b033642ac0abc1c174afcbe9f224 33a5d3e2048621a7982cc08d5d9e37bc 65abe96df8a651758894b6e58a34e42c b82798be3fd7b3d96de27e65` |
| `expected` | `132d477d0c24306181c6ad01590d39be9b2404ed32ccbe0eb1f169680212cc1c` |

**Vector 10** — [Classic McEliece mceliece6688128 kat_kem.rsp record 0: decapsulation recovers the shared secret](https://classic.mceliece.org/nist/mceliece-kat-20221023.tar.gz)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `privateKey` | `fd1bf592a954ac3012bb9b07c8947e57 08bc44b74fcdffa99e9696fb55e004d9 ffffffff00000000810b331f491bde15 6619ef009d041f1b49054905880d440e …` (13932 bytes; the full value is in the source) |
| `input` | `01278f7400972fd05aa6368a4f866249 7a5a31a3e968bf81b49ebdfb8331769e a1bb5275ad46d33f8d6624c2f305f961 dc8812850b20c2fe3c7e8fb0393bbbff fc0458a01765ec519ab332da952047b8 a87c618d3bf28046b94f82872a75d1c0 90dbe768168df6d7d6755fafb5ae050a e520bf7ed641c90161dfb70e4a5ef9a8 d64856cac821d98b00e8145d3462a4db 6cf2e0c002dba11257d7716e22f18f8e 28113cdf5fe7581cc82854165ab93e36 d4080f8e7b8116667e9c12d515a443ea 002e609c6f5ee839ff282d8eaaf6bb8c` |
| `expected` | `7b35200a8387a2bb376394a68473e7abe5ce392484dabe6c1ef0ee2cd9f68022` |

**Vector 11** — [Classic McEliece mceliece6960119 kat_kem.rsp record 0: decapsulation recovers the shared secret](https://classic.mceliece.org/nist/mceliece-kat-20221023.tar.gz)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `privateKey` | `4040ada87999cf698e6bf15460b494a3 963ee1309a3db11a7dd2429a5aa4b5d3 ffffffff000000004c1ee20e9603710e 8518910fca156e02590731089005eb05 …` (13948 bytes; the full value is in the source) |
| `input` | `63c39d29314866a0fe528b3d5de37d5c 6f72279ee711036198b0c2ca1f293d35 41e0d1467d63d2e5c92b8060001cf002 017f60b954c5dc457ba63c59bbe330bb 66bc8726e605acd0e90cd7167376f68c c071d4f931349564ef28d7eab3d1ff61 563ee1defd95a548004979736ab1b39b e08d57a49f39988f23574a5a06fc4c31 7f08c1b842ef844773be74701e57ec91 107de40c6eeb222630621a6fbf2a4cb8 ccb9c395abd85fdc03c0fbe0e56ec9f7 052b90608e21653fa2de1ad62c68c265 6c06` |
| `expected` | `ace16b9d437e56401128ede4ee3a1c45cfe13d8e8288a3754db4d9b78c5a3ddf` |

**Vector 12** — [Classic McEliece mceliece8192128 kat_kem.rsp record 0: decapsulation recovers the shared secret](https://classic.mceliece.org/nist/mceliece-kat-20221023.tar.gz)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `privateKey` | `55b9d5a28f6a2ba670726f23a7393d0b 55c661ae6b6a66688696017c70b8b894 ffffffff0000000094198c175b1c860f ad0df20839022f095612e0096c15ea17 …` (14120 bytes; the full value is in the source) |
| `input` | `ad9728e7519c5f851fda1148cf652893 c8884288930995416f95798c4f2e0151 ff617828cbcbc74ba3870d04e41fb875 be651a8070e23b89d47362833d899abb 57d25886fd9b71c2027c3f32fb5d6999 22053ba4e7297e9ee87838dbc06677e0 b4eb4d9edea0945a6d0a01020bb30c33 cf0498373b9af3517dd20331ffb1f817 7946251efa80be477e96d8acaf5f2ab9 3de67868de506b44e0a1fa058176450a 380901a5aa0e033642a7eccd50c77916 268ad225afb3b7a1560faf4cf476acff bbfa30d1eff17fbd73b109cf9ff2ecc0` |
| `expected` | `82351702a2c3973644cb735fc9b6cea8fe526d7d729ee134fc12c0201690e854` |

---

[← All algorithms](../README.md)
