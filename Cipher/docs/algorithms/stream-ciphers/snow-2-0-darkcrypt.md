# SNOW 2.0 (DarkCrypt)

> Ekdahl and Johansson's SNOW 2.0 stream cipher (16-word GF(2^32) LFSR + AES-S-box-based FSM), as implemented in the DarkCrypt Total Commander plugin's 256-bit-key-only build. The algorithm core is bit-exact to the published SNOW 2.0 specification.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Patrik Ekdahl, Thomas Johansson (base design); DarkCrypt port by Alexander Myasnikov |
| Year | 2002 |
| Origin | 🇸🇪 Sweden |
| Source | [`algorithms/stream/darkcrypt-snow2.js`](../../../algorithms/stream/darkcrypt-snow2.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Distinguishing attacks | SNOW 2.0 has known distinguishing attacks with complexity below exhaustive search in academic literature; superseded by SNOW 3G / SNOW-V for production use. | Use a vetted, currently-recommended stream cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [SNOW 2.0 specification (Ekdahl and Johansson)](https://www.ecrypt.eu.org/stream/p3ciphers/snow/snow2.pdf)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Snow2 — keystream from incrementing key, zero IV, zero input](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `7aa40e9615aed53d3a69c1ddc2912a1a 86dafe5c0432ac08956837bd05ab2009 1989294a98d23cf63531e62ae1873175 524a2f14ce103ae166ab132c435767ef e875062bddf190d760d4c635ffaffd36 0f399c3c4f2df769d1590f74f034917a a0db223318e74778f9181a8e0c893c61 59191db89f5ffd40293fbc8cba6a39b1` |

**Vector 2** — [DarkCrypt Snow2 — incrementing key/plaintext, zero IV](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `7aa50c9511abd33a3260cbd6ce9c2415 96cbec4f1027ba1f8d712da619b63e16 39a80b69bcf71ad11d18cc01cdaa1f5a 627b1d27fa250cd65e9229177f6a59d0` |

---

[← All algorithms](../README.md)
