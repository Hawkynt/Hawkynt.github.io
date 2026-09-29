# DAGINDA (DarkCrypt)

> SHACAL-2-derived block cipher from the DarkCrypt Total Commander plugin: the SHA-256 compression round (Sigma0/Sigma1, Ch, Maj, all 64 standard round constants) used as a keyed permutation with additive pre-whitening and XOR post-whitening from the key, driven by a bespoke 64-round ARX/S-box key schedule instead of SHA-256's message expansion. 256-bit block, 512-bit key.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Alexander Myasnikov ("Zarya" project) |
| Year | 2009 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-daginda.js`](../../../algorithms/block/darkcrypt-daginda.js) |

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
| Non-standard variant | SHACAL-2-derived compression permutation with a custom key schedule and additional whitening; unanalyzed and not recommended for real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [SHACAL-2 (related construction)](https://www.cosic.esat.kuleuven.be/nessie/reports/phase2/SHACAL-2.pdf)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Daginda — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `expected` | `2140ee25d494fbe23f145469a9a30033bce58ed95e72461384d0cacb360bc0f3` |

**Vector 2** — [DarkCrypt Daginda — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `eeeaa053171679f88686f8f140b6a7dec3f9f1a3594a9ef69aa5ac7117cd73f2` |

**Vector 3** — [DarkCrypt Daginda — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10 1112131415161718191a1b1c1d1e1f20 2122232425262728292a2b2c2d2e2f30 3132333435363738393a3b3c3d3e3f40` |
| `input` | `101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f` |
| `expected` | `fb7303ab49c92fe2c7f019af4bff99c8383275946ff5e45cfa47e6d137d9285c` |

---

[← All algorithms](../README.md)
