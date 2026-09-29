# COBRA-128-576 (DarkCrypt)

> DarkCrypt Total Commander plugin block cipher: 36 rounds over a 128-bit block (four 32-bit words), round-robin between three Blowfish-style F-box sets, keyed via a 576-bit key through a two-pass Blowfish-style self-encryption schedule applied to a pi-seeded constant table.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Alexander Myasnikov (DarkCrypt "Zarya" project) |
| Year | 2009 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-cobra128576.js`](../../../algorithms/block/darkcrypt-cobra128576.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 72 bytes (576 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Non-standard variant | Undocumented, unanalyzed DarkCrypt-only cipher; not recommended for real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [Blowfish (F-function and constant source)](https://www.schneier.com/academic/archives/1994/09/description_of_a_new.html)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Cobra128 -- zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 0000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `324b3eb95a184327b23cefd83d8e330b` |

**Vector 2** — [DarkCrypt Cobra128 -- incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 4041424344454647` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `56730009366ee99eb8c4375eb94bed1a` |

**Vector 3** — [DarkCrypt Cobra128 -- shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10 1112131415161718191a1b1c1d1e1f20 2122232425262728292a2b2c2d2e2f30 3132333435363738393a3b3c3d3e3f40 4142434445464748` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `cdb50a1858e9968de5a562073a74ead6` |

**Vector 4** — [DarkCrypt Cobra128 -- random key/plaintext #1](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0826181ab27ae68c63f4760fb1a483a4 fb4a492e8a5750cf191602e84441d14a de46bd13cab2adfcb07d8769657dce7d 0e97e7a164eed0561f58780e4b814509 c274f74eb710da07` |
| `input` | `af8c2de23857e7cdd85c7e1a2599d2f7` |
| `expected` | `1c9fe1280acbeb6807840a517864d03c` |

**Vector 5** — [DarkCrypt Cobra128 -- random key/plaintext #2](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `3adcf85d3144fb1c28844dd151324434 fd371fe213b4feefc54b231c67d9d111 fe49523a1c2bb5a440a768bc9853e5eb abe059a5b307ca81de6892504304254b 6b66b40eccc65d18` |
| `input` | `71d64f6ee14c98cdacea12511fc52921` |
| `expected` | `d7f7bfe852a0e28c20cfa4c3472e395b` |

---

[← All algorithms](../README.md)
