# WG (DarkCrypt)

> Welch-Gong (WG) transformation stream cipher: an 11-stage LFSR over GF(2^29) filtered by a degree-11 normal-basis nonlinear transformation. DarkCrypt's variant uses a compact byte-interleaved key/IV load, always a 128-bit key and 128-bit IV, and 44 nonlinear-feedback initialization clocks with a tap-11-inclusive key-init vector.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Yassir Nawaz, Guang Gong (base WG design); DarkCrypt variant |
| Year | 2005 |
| Origin | 🇨🇦 Canada |
| Source | [`algorithms/stream/darkcrypt-wg.js`](../../../algorithms/stream/darkcrypt-wg.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Non-standard variant | Modified WG cipher with a DarkCrypt-specific key/IV load and initialization schedule; not equivalent to the reviewed eSTREAM submission and not recommended for real use. | Use a vetted stream cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [The WG Stream Cipher (Nawaz, Gong)](https://www.ecrypt.eu.org/stream/p2ciphers/wg/wg_p2.pdf)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Wg — keystream from incrementing key, zero IV, zero input](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `ae0921b826d05f4df117e08fc6609be4 42e73d8683f6bb5d3064cfe387b40a40 2c54f4772c3af5503b5b7fa041c8a35c c5b90e57bc31eaa63321760a632b0fbd 5920703d4cb40fd2222bdbc5bc3afeb9 cd11554f199bddb7cb510acd97be0af8 90a58a5810afde38e6eda91632e166b5 ed710656e6f9604f6466dc2a3b2a62f1` |

**Vector 2** — [DarkCrypt Wg — incrementing key, zero IV, incrementing plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `ae0823bb22d5594af91eea84ca6d95eb 52f62f9597e3ad4a287dd5f89ba9145f 0c75d654081fd3771372558b6de58d73 f5883c648804dc910b184c315f163182` |

---

[← All algorithms](../README.md)
