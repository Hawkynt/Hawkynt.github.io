# Xoodyak Hash

> NIST Lightweight Cryptography finalist based on the Xoodoo permutation. Designed for resource-constrained environments with strong security properties.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Lightweight Cryptography |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Joan Daemen, Seth Hoffert, Michaël Peeters, Gilles Van Assche, Ronny Van Keer |
| Year | 2019 |
| Origin | 🌐 International |
| Source | [`algorithms/hash/xoodyak-hash.js`](../../../algorithms/hash/xoodyak-hash.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 32 bytes (256 bits) |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [NIST LWC Finalist](https://csrc.nist.gov/Projects/lightweight-cryptography/finalists)
- [Xoodyak Specification](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/xoodyak-spec-final.pdf)
- [Xoodoo Permutation](https://eprint.iacr.org/2018/767.pdf)

## References

- [XKCP - eXtended Keccak Code Package (Xoodyak reference implementation)](https://github.com/XKCP/XKCP)

## Test vectors

10 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Xoodyak Hash: empty message (NIST LWC)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/xoodyak/crypto_hash/xoodyakround3/LWC_HASH_KAT_256.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `ea152f2b47bce24efb66c479d4adf17bd324d806e85ff75ee369ee50dc8f8bd1` |

**Vector 2** — [Xoodyak Hash: 0x00 (NIST LWC)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/xoodyak/crypto_hash/xoodyakround3/LWC_HASH_KAT_256.txt)

| Field | Value |
| --- | --- |
| `input` | `00` |
| `expected` | `27921f8ddf392894460b70b3ed6c091e6421b7d2147dcd6031d7efebad3030cc` |

**Vector 3** — [Xoodyak Hash: 0x0001 (NIST LWC)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/xoodyak/crypto_hash/xoodyakround3/LWC_HASH_KAT_256.txt)

| Field | Value |
| --- | --- |
| `input` | `0001` |
| `expected` | `dd3f12e89db41c61d3c05779705fa946a8c69c79eefdc1b4a966a5f1ab35073d` |

**Vector 4** — [Xoodyak Hash: 0x000102 (NIST LWC)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/xoodyak/crypto_hash/xoodyakround3/LWC_HASH_KAT_256.txt)

| Field | Value |
| --- | --- |
| `input` | `000102` |
| `expected` | `72abd350dc287e8c4b95dd37bd796d79f90026c1bd4e0d99d2117baab26bc2ca` |

**Vector 5** — [Xoodyak Hash: 0x00010203 (NIST LWC)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/xoodyak/crypto_hash/xoodyakround3/LWC_HASH_KAT_256.txt)

| Field | Value |
| --- | --- |
| `input` | `00010203` |
| `expected` | `a13ae46f62e433ce4cad9e4f24c46f37b6b3815c8539a3659daaecaae1ab8fdb` |

**Vector 6** — [Xoodyak Hash: 0x0001020304 (NIST LWC)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/xoodyak/crypto_hash/xoodyakround3/LWC_HASH_KAT_256.txt)

| Field | Value |
| --- | --- |
| `input` | `0001020304` |
| `expected` | `042383068c131a0d365b781dfcb20e855f4a68de2072aa8d1e16181563d6f622` |

**Vector 7** — [Xoodyak Hash: 0x000102030405060708 (NIST LWC)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/xoodyak/crypto_hash/xoodyakround3/LWC_HASH_KAT_256.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708` |
| `expected` | `d926f7e44b263cba8f98e2a52b7be175d406a2e81b462408bdbc408784c4284f` |

**Vector 8** — [Xoodyak Hash: 0x000102030405060708090A0B0C0D0E0F (NIST LWC)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/xoodyak/crypto_hash/xoodyakround3/LWC_HASH_KAT_256.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `9ea695347cdddff9bc63ece30fe231441d581768fe223dd6bd7367094fd216b3` |

**Vector 9** — [Xoodyak Hash: 0x000102030405060708090A0B0C0D0E0F10111213 (NIST LWC)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/xoodyak/crypto_hash/xoodyakround3/LWC_HASH_KAT_256.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f10111213` |
| `expected` | `9bebe7579ec1d075b6768ae981c54c7d60db82931b074a618b0a68f84cbccfe6` |

**Vector 10** — [Xoodyak Hash: 32-byte message (NIST LWC)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/xoodyak/crypto_hash/xoodyakround3/LWC_HASH_KAT_256.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `cebe4aff9eac2218017dda5f8207ba830e989187256539bd7d31ae5e94ff0c6e` |

---

[← All algorithms](../README.md)
