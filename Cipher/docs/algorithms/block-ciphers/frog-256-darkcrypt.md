# FROG-256 (DarkCrypt)

> FROG AES candidate: fully key-dependent substitution/permutation network, where the user key derives a large "internal key" of per-round S-box and diffusion tables rather than driving fixed round logic. 128-bit block, 256-bit key, 8 rounds. As implemented in the DarkCrypt Total Commander plugin, matching the standard FROG-128 construction exactly.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Dianelos Georgoudis, Damian Leroux, Billy Simón Chaves (TecApro Intl.); DarkCrypt packaging by Alexander Myasnikov |
| Year | 1998 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-frog.js`](../../../algorithms/block/darkcrypt-frog.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Weak key classes | Wagner et al. found significant weak-key classes and chosen-plaintext/ciphertext attacks; slow key setup; not selected as an AES finalist. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [FROG (Wikipedia)](https://en.wikipedia.org/wiki/FROG)
- [The FROG Encryption Algorithm (TecApro AES submission)](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Algorithm-Validation-Program/documents/aes-development/frog.pdf)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST AES round-1 FROG KAT ecb_vk.txt, KEYSIZE=256, I=1 (byte order reversed, the little-endian convention this build uses)](https://web.archive.org/web/20070109105622if_/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/frog-vals.zip)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000080` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `e100a4921e34bc89b9c6182b42c6b4b3` |

**Vector 2** — [DarkCrypt Frog — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `b57897cc533074f1a543bf69b65c7bbc` |

**Vector 3** — [DarkCrypt Frog — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `2bbb1026a5608ad9bd14ea5064982eb9` |

**Vector 4** — [DarkCrypt Frog — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `26fba6a7bbb41616d89c83bd83d97a47` |

---

[← All algorithms](../README.md)
