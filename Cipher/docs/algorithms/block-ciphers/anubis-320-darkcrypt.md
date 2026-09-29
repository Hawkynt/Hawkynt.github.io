# Anubis-320 (DarkCrypt)

> Original (pre-tweak) Anubis block cipher, 320-bit key (N=10, R=18 rounds). Involutional SPN with byte substitution and MDS diffusion, using Barreto's original NESSIE-submission S-box. As implemented in the DarkCrypt Total Commander plugin.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Vincent Rijmen, Paulo S.L.M. Barreto; DarkCrypt integration by Alexander Myasnikov |
| Year | 2000 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-anubis320.js`](../../../algorithms/block/darkcrypt-anubis320.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 40 bytes (320 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Related-key weakness | The original (pre-tweak) Anubis S-box construction was later replaced by a tweaked variant that removes a related-key weakness. This implementation intentionally reproduces the original, weaker S-box for DarkCrypt compatibility. | Use the tweaked Anubis variant or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [NESSIE Project - Anubis Specification](https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/anubis.zip)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NESSIE submission test vectors for the ORIGINAL (pre-tweak) Anubis, 320-bit key, set 1 vector 0](https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/anubis.zip)

| Field | Value |
| --- | --- |
| `key` | `80000000000000000000000000000000 00000000000000000000000000000000 0000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `1704d72cc68576024bcc3980d822eaa4` |

**Vector 2** — [DarkCrypt Anubis-320 — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 0000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `21d367688c048d8333ea920c49111f62` |

**Vector 3** — [DarkCrypt Anubis-320 — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 2021222324252627` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `a60289033fab5b6230fb38dd22622c98` |

**Vector 4** — [DarkCrypt Anubis-320 — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10 1112131415161718191a1b1c1d1e1f20 2122232425262728` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `14f1545dbeb6b9ea53a1e90c00518611` |

---

[← All algorithms](../README.md)
