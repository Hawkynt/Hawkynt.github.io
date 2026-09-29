# DFC-128/256 (DarkCrypt)

> Decorrelated Fast Cipher (DFCv1): 8-round Feistel network with a round function based on 64-bit modular multiply-add mod 2^64+13 followed by a table-based confusion permutation. 128-bit block, 256-bit key. As implemented in the DarkCrypt Total Commander plugin, matching the standard DFCv1 AES-submission construction exactly.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Serge Vaudenay, Loïc Granboulan, Fabrice Levy-dit-Vehel, Phong Nguyen, Thomas Pornin, Jacques Stern (ENS/CNRS/France Télécom); DarkCrypt packaging by Alexander Myasnikov |
| Year | 1998 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-dfc.js`](../../../algorithms/block/darkcrypt-dfc.js) |

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
| Weak keys / reduction concerns | Coppersmith identified weak-key issues in the original key schedule (addressed by the later DFCv2 revision); not selected as an AES finalist. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [DFC (Decorrelated Fast Cipher) (Wikipedia)](https://en.wikipedia.org/wiki/DFC_(cipher))
- [On the Decorrelated Fast Cipher (DFC) and Its Theory (Knudsen, Rijmen)](https://link.springer.com/chapter/10.1007/3-540-48519-8_7)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST AES round-1 DFC KAT ecb_vk.txt, KEYSIZE=256, I=1](https://web.archive.org/web/20070109105903if_/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/dfc-vals.zip)

| Field | Value |
| --- | --- |
| `key` | `8000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `b098bb87597a3fb0dca816d24021e65e` |

**Vector 2** — [DarkCrypt Dfc — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `0205d7133ed37cee091c36f24a74592a` |

**Vector 3** — [DarkCrypt Dfc — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `e2dcada042d08fa0426707e23d34c08d` |

**Vector 4** — [DarkCrypt Dfc — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `8b3a1c45c001590bd00477f664e98c44` |

---

[← All algorithms](../README.md)
