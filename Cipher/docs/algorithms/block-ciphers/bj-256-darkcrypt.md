# BJ-256 (DarkCrypt)

> Homegrown ARX block cipher from the DarkCrypt Total Commander plugin with no public specification: an 8x32-bit-word (256-bit) block cipher whose key schedule is a raw identity copy of the 512-bit key into 16 round-key words, sandwiching a fully-unrolled keyless ARX mixing network between leading/trailing key whitening.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Alexander Myasnikov ("Zarya" project) — DarkCrypt original design, no public specification |
| Year | 2009 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-bj256.js`](../../../algorithms/block/darkcrypt-bj256.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 64 bytes (512 bits) |
| Block sizes | 32 bytes (256 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Encrypting half the key reveals the other half | The key schedule is an identity copy and the mixing network is keyless, so the cipher is Even-Mansour over a public permutation and E_K(K[0..31]) = K[32..63] for every key. Anyone who can get that one block encrypted learns half the key outright, and knowing the permutation reduces the rest to a generic Even-Mansour attack. | Use AES or another vetted cipher. |
| All-zero weak key | The mixing network carries no round constants, so it fixes the all-zero state, and with an all-zero key the whitening XORs do nothing either. The all-zero block is returned unencrypted. | Never use an all-zero key. |
| Unanalyzed proprietary design | No public specification, cryptanalysis or design rationale exists for BJ-256; the key schedule performs no mixing at all (round keys are the raw key words). Not recommended for any real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Bj256 — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10 1112131415161718191a1b1c1d1e1f20 2122232425262728292a2b2c2d2e2f30 3132333435363738393a3b3c3d3e3f40` |
| `input` | `101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f` |
| `expected` | `4647490ce33a0ebb7707574d415cc6e9929ce981a37728826b815378b6ae7606` |

**Vector 2** — [DarkCrypt Bj256 — incrementing key, zero plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `expected` | `3b18c79b66ca26134f0e9c1d2fa880dfde6b57ae7a9247fd36de33e9ee684f5e` |

**Vector 3** — [DarkCrypt Bj256 — incrementing key, all-ones plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff` |
| `expected` | `fd4831071386b5408c17fd132c040cd43b7e94443ca66f871a2ff446795ae46c` |

**Vector 4** — [DarkCrypt Bj256 — all-zero key, repeated-nibble plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` |
| `expected` | `b8b262199b4bea042ab05a5b21f19042d67554de0cddbcf49405211c8f2ec810` |

**Vector 5** — [DarkCrypt Bj256 — all-ones key, zero plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff` |
| `input` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `expected` | `f1eb30d7e16b4331953e62a13244b0f10bf39499fb759de1aef5c6751c68fc16` |

**Vector 6** — [DarkCrypt Bj256 — encrypting the key's first half returns its second half](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f` |

---

[← All algorithms](../README.md)
