# Anubis-256 (DarkCrypt)

> Original (pre-tweak) Anubis block cipher, 256-bit key (N=8, R=16 rounds). Involutional SPN with byte substitution and MDS diffusion, using Barreto's original NESSIE-submission S-box. As implemented in the DarkCrypt Total Commander plugin.

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
| Source | [`algorithms/block/darkcrypt-anubis256.js`](../../../algorithms/block/darkcrypt-anubis256.js) |

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
| Related-key weakness | The original (pre-tweak) Anubis S-box construction was later replaced by a tweaked variant that removes a related-key weakness. This implementation intentionally reproduces the original, weaker S-box for DarkCrypt compatibility. | Use the tweaked Anubis variant or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [NESSIE Project - Anubis Specification](https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/anubis.zip)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NESSIE submission test vectors for the ORIGINAL (pre-tweak) Anubis, 256-bit key, set 1 vector 0](https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/anubis.zip)

| Field | Value |
| --- | --- |
| `key` | `8000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `e086ac456b3ce513edf5dfddd63b7193` |

**Vector 2** — [DarkCrypt Anubis-256 — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `05199928bb3546b5ff7b0765b89ec522` |

**Vector 3** — [DarkCrypt Anubis-256 — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `78f573817a175592b362ea43b2f3c6fc` |

**Vector 4** — [DarkCrypt Anubis-256 — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `099b769adfd3aa1d26cff34e238e03da` |

---

[← All algorithms](../README.md)
