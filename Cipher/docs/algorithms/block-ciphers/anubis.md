# Anubis

> 128-bit block cipher designed by Vincent Rijmen and Paulo Barreto for the NESSIE project. Features variable key length from 128-320 bits in 32-bit increments.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Vincent Rijmen, Paulo S.L.M. Barreto |
| Year | 2000 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/block/anubis.js`](../../../algorithms/block/anubis.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) to 40 bytes (320 bits) in steps of 4 bytes |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [NESSIE Project - Anubis Specification](https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/anubis.zip)
- [Wikipedia - Anubis (cipher)](https://en.wikipedia.org/wiki/Anubis_(cipher))
- [Original Anubis Paper](https://www.cosic.esat.kuleuven.be/publications/article-40.pdf)

## References

- [NESSIE Reference Implementation](https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions.html)
- [Crypto++ Anubis Implementation](https://github.com/weidai11/cryptopp/blob/master/anubis.cpp)

## Test vectors

10 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Anubis-tweaked-256 vector 1/zero](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `e5391940ae209c9ed3f26bb9b272d084` |

**Vector 2** — [DarkCrypt Anubis-tweaked-256 vector 2/incr](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `25167975ba15a98c648d6f5e4e8bdb39` |

**Vector 3** — [DarkCrypt Anubis-tweaked-256 vector 3/incr2](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `c093290cd5240a55042f5550ee8403ca` |

**Vector 4** — [LibTomCrypt Tweaked Vector - 128-bit key (0x80 prefix)](https://github.com/libtom/libtomcrypt/blob/develop/src/ciphers/anubis.c)

| Field | Value |
| --- | --- |
| `key` | `80000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `b835bdc334829d8371bfa371e4b3c4fd` |

**Vector 5** — [LibTomCrypt Tweaked Vector - 160-bit key (0x80 prefix)](https://github.com/libtom/libtomcrypt/blob/develop/src/ciphers/anubis.c)

| Field | Value |
| --- | --- |
| `key` | `8000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `9759794b5ca0707324efb35867cad4b3` |

**Vector 6** — [LibTomCrypt Tweaked Vector - 192-bit key (0x80 prefix)](https://github.com/libtom/libtomcrypt/blob/develop/src/ciphers/anubis.c)

| Field | Value |
| --- | --- |
| `key` | `800000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `7d623b52c74c64d8ebc72d579785438f` |

**Vector 7** — [LibTomCrypt Tweaked Vector - 224-bit key (0x80 prefix)](https://github.com/libtom/libtomcrypt/blob/develop/src/ciphers/anubis.c)

| Field | Value |
| --- | --- |
| `key` | `80000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `689e05946a94438fe78e373d249792f5` |

**Vector 8** — [LibTomCrypt Tweaked Vector - 256-bit key (0x80 prefix)](https://github.com/libtom/libtomcrypt/blob/develop/src/ciphers/anubis.c)

| Field | Value |
| --- | --- |
| `key` | `8000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `9600f07691692987f5e597dbdbaf1b0a` |

**Vector 9** — [LibTomCrypt Tweaked Vector - 288-bit key (0x80 prefix)](https://github.com/libtom/libtomcrypt/blob/develop/src/ciphers/anubis.c)

| Field | Value |
| --- | --- |
| `key` | `80000000000000000000000000000000 00000000000000000000000000000000 00000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `0fc7a2c01117ac43525edf6cf396336c` |

**Vector 10** — [LibTomCrypt Tweaked Vector - 320-bit key (0x80 prefix)](https://github.com/libtom/libtomcrypt/blob/develop/src/ciphers/anubis.c)

| Field | Value |
| --- | --- |
| `key` | `80000000000000000000000000000000 00000000000000000000000000000000 0000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `fee20e2a9dc583baa3a6d6a6f2e806a5` |

---

[← All algorithms](../README.md)
