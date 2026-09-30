# Edon80

> Edon80 quasigroup-based stream cipher, an eSTREAM hardware-profile candidate built from an 80-stage pipeline of e-transformers, each bound to one of four fixed 4x4 quasigroups. This build uses the 80-bit key / 64-bit IV parameters of the DarkCrypt Total Commander plugin.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Danilo Gligoroski, Smile Markovski, Ljupco Kocarev, Marjan Gusev |
| Year | 2005 |
| Origin | 🌐 International |
| Source | [`algorithms/stream/darkcrypt-edon80.js`](../../../algorithms/stream/darkcrypt-edon80.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 10 bytes (80 bits) |
| Nonce sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Key-recovery distinguishing attack](https://link.springer.com/chapter/10.1007/978-3-540-76900-2_35) | — | Not recommended for new designs; Edon80 was not selected for the final eSTREAM portfolio. |

## Documentation

- [The Stream Cipher Edon80 (Gligoroski, Markovski, Knapskog)](https://link.springer.com/chapter/10.1007/978-3-540-68351-3_12)
- [eSTREAM: the ECRYPT Stream Cipher Project - Edon80 specification](https://www.ecrypt.eu.org/stream/p3ciphers/edon80/edon80_p3.pdf)

## References

- [DarkCrypt Total Commander plugin](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Edon-80 - 80-bit key, zero IV keystream](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00010203040506070809` |
| `iv` | `0000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `50ba2a55711e9be5bd8901ceab155385 48891e65601888716d14b46e1550ad11 f90774f6514f403d6cfd118cf6e3baf3 83cc171d2b4b965cb37d14d175a9bcb8 ddda1b8c282e811f199e73870c96b665 95e8d80389e7682cd22e0ac9b2fa7d2c 07184c5d24bcb2c6c7f855db25de890a 6feed9dd07fbb135a4fea0bce4239718` |

**Vector 2** — [DarkCrypt Edon-80 - 80-bit key, zero IV, incrementing plaintext (fresh setup)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00010203040506070809` |
| `iv` | `0000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `50bb2856751b9de2b5800bc5a7185d8a 58980c76740d9e66750dae75094db30e d92656d5756a661a44d43ba7dace94dc b3fd252e1f7ea06b8b442eea49948287` |

**Vector 3** — [DarkCrypt Edon-80 — non-zero key and IV, 48-byte message (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0b30557a9fc4e90e3358` |
| `iv` | `073c71a6db10457a` |
| `input` | `03203d5a7794b1ceeb0825425f7c99b6 d3f00d2a4764819ebbd8f5122f4c6986 a3c0ddfa1734516e8ba8c5e2ff1c3956` |
| `expected` | `933fa01bb238017131091f4e3ec45031 5ac64ef891922797789a5b757063f3ba 0043a4f329ca8e5fd66eac9c27cdc5cc` |

---

[← All algorithms](../README.md)
