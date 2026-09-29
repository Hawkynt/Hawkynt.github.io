# Schnorr (BIP-340)

> Schnorr signatures for secp256k1 curve as specified in BIP-340. Used in Bitcoin Taproot (BIP-341) for efficient, provably secure digital signatures with support for multisignatures and batch verification.

## Properties

| Property | Value |
| --- | --- |
| Category | Asymmetric Ciphers |
| Sub-category | Digital Signatures |
| Security status | 🛡️ Secure |
| Complexity | Advanced |
| Inventor | Claus Schnorr (algorithm), Pieter Wuille et al. (BIP-340) |
| Year | 2020 |
| Origin | Not specified |
| Source | [`algorithms/asymmetric/schnorr.js`](../../../algorithms/asymmetric/schnorr.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Signature sizes | 64 bytes (512 bits) |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [BIP-340: Schnorr Signatures for secp256k1](https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki)
- [BIP-341: Taproot - SegWit version 1 spending rules](https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki)
- [Original Schnorr Paper (1991)](https://www.math.uni-frankfurt.de/~dmst/research/papers/schnorr.proof_of_signature.pdf)

## References

- [libsecp256k1 Implementation](https://github.com/bitcoin-core/secp256k1)
- [Bitcoin Core Integration](https://github.com/bitcoin/bitcoin/pull/17977)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [BIP-340 Vector #0 - Basic signature](https://github.com/bitcoin/bips/blob/master/bip-0340/test-vectors.csv)

| Field | Value |
| --- | --- |
| `secretKey` | `0000000000000000000000000000000000000000000000000000000000000003` |
| `publicKey` | `f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9` |
| `auxRand` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `expected` | `e907831f80848d1069a5371b40241036 4bdf1c5f8307b0084c55f1ce2dca8215 25f66a4a85ea8b71e482a74f382d2ce5 ebeee8fdb2172f477df4900d310536c0` |

**Vector 2** — [BIP-340 Vector #1 - Non-zero signature](https://github.com/bitcoin/bips/blob/master/bip-0340/test-vectors.csv)

| Field | Value |
| --- | --- |
| `secretKey` | `b7e151628aed2a6abf7158809cf4f3c762e7160f38b4da56a784d9045190cfef` |
| `publicKey` | `dff1d77f2a671c5f36183726db2341be58feae1da2deced843240f7b502ba659` |
| `auxRand` | `0000000000000000000000000000000000000000000000000000000000000001` |
| `input` | `243f6a8885a308d313198a2e03707344a4093822299f31d0082efa98ec4e6c89` |
| `expected` | `6896bd60eeae296db48a229ff71dfe07 1bde413e6d43f917dc8dcf8c78de3341 8906d11ac976abccb20b091292bff4ea 897efcb639ea871cfa95f6de339e4b0a` |

**Vector 3** — [BIP-340 Vector #2 - Different aux_rand](https://github.com/bitcoin/bips/blob/master/bip-0340/test-vectors.csv)

| Field | Value |
| --- | --- |
| `secretKey` | `c90fdaa22168c234c4c6628b80dc1cd129024e088a67cc74020bbea63b14e5c9` |
| `publicKey` | `dd308afec5777e13121fa72b9cc1b7cc0139715309b086c960e18fd969774eb8` |
| `auxRand` | `c87aa53824b4d7ae2eb035a2b5bbbccc080e76cdc6d1692c4b0b62d798e6d906` |
| `input` | `7e2d58d8b3bcdf1abadec7829054f90dda9805aab56c77333024b9d0a508b75c` |
| `expected` | `5831aaeed7b44bb74e5eab94ba9d4294 c49bcf2a60728d8b4c200f50dd313c1b ab745879a5ad954a72c45a91c3a51d3c 7adea98d82f8481e0e1e03674a6f3fb7` |

**Vector 4** — [BIP-340 Vector #3 - Maximum values test](https://github.com/bitcoin/bips/blob/master/bip-0340/test-vectors.csv)

| Field | Value |
| --- | --- |
| `secretKey` | `0b432b2677937381aef05bb02a66ecd012773062cf3fa2549e44f58ed2401710` |
| `publicKey` | `25d1dff95105f5253c4022f628a996ad3a0d95fbf21d468a1b33f8c160d8f517` |
| `auxRand` | `ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff` |
| `input` | `ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff` |
| `expected` | `7eb0509757e246f19449885651611cb9 65ecc1a187dd51b64fda1edc9637d5ec 97582b9cb13db3933705b32ba982af5a f25fd78881ebb32771fc5922efc66ea3` |

---

[← All algorithms](../README.md)
