# Pomaranch (DarkCrypt)

> Cascade Jump Controlled Sequence Generator (CJCSG), the 128-bit-key stream cipher behind Pomaranch: nine cascaded jump registers whose cells switch between shift and feedback roles under a key-dependent nonlinear filter, producing keystream as the XOR of a fixed tap across all sections.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Cees J.A. Jansen, Tor Helleseth, Alexander Kholosha |
| Year | 2005 |
| Origin | 🇳🇴 Norway |
| Source | [`algorithms/stream/darkcrypt-pomaranch.js`](../../../algorithms/stream/darkcrypt-pomaranch.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Nonce sizes | 14 bytes (112 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Cascade Jump Controlled Sequence Generator (CJCSG)](https://www.ecrypt.eu.org/stream/ciphers/pomaranch/pomaranch.pdf)
- [eSTREAM Pomaranch Page](https://www.ecrypt.eu.org/stream/pomaranchp3.html)

## References

- [DarkCrypt Total Commander plugin](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Pomaranch - 128-bit key, zero IV keystream](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `0000000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `e5d7f7c09b1f1d3f672216e3e3103fce 0619eb25cce07c03a2f8be6925248beb 5dd63ea00a03885b02c97b77aab437b9 b2642c0d78c5ddc443bc4a28032f7b44 1cc09ba2992b57b6074a370eee93503e fd988c1f2b873780f6afd0c662ee5730 648a969b2458be556a4371e1e0cd4b39 0cb028860b122db7b7116a243d56f448` |

**Vector 2** — [DarkCrypt Pomaranch - 128-bit key, zero IV, incrementing plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `0000000000000000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `e5d6f5c39f1a1b386f2b1ce8ef1d31c1 1608f936d8f56a14bae1a472393995f4 7df71c832e26ae7c2ae0515c86991996 82551e3e4cf0ebf37b8570133f12457b` |

---

[← All algorithms](../README.md)
