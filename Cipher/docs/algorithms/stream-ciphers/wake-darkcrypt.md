# WAKE (DarkCrypt)

> David Wheeler's WAKE stream cipher as implemented in the DarkCrypt Total Commander plugin: a 257-word table-driven M() cascade over four running registers, with ciphertext-autokeyed feedback between words. Only a 128-bit key is actually consumed despite the algorithm's commonly documented 256-bit key.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | ❌ Broken |
| Complexity | Intermediate |
| Inventor | David Wheeler |
| Year | 1993 |
| Origin | 🇬🇧 United Kingdom |
| Source | [`algorithms/stream/darkcrypt-wake.js`](../../../algorithms/stream/darkcrypt-wake.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Chosen plaintext/ciphertext attacks | WAKE's M() cascade is known to be vulnerable to chosen plaintext/ciphertext attacks; the DarkCrypt variant additionally autokeys on its own ciphertext output. | Use a vetted stream cipher. |

## Documentation

- [Wheeler: A Bulk Data Encryption Algorithm](https://www.cl.cam.ac.uk/techreports/UCAM-CL-TR-249.pdf)
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Wake — keystream from incrementing key, zero input](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `0c0d0e0fadce43a5bd2e485c632d8608 d6695564b103608d49b8c481e7a9d859 66147da4967a7d9b18978fbf39356747 98116f610e7f0bd118355b7a0167a3b1 737e20e2aeaffc47f2f082e4396e023e 119c52e454e50e9dc9e311f0c91a88bb 07efb68dc574f32ad06b7c3ec545539b 3e9fd0da3015901b8c5102d72dd203ae` |

**Vector 2** — [DarkCrypt Wake — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `0c0c0c0c9995d326fda1a6bbe95a8976 35a9235a80fcce412c604bee1f002bb3 97b0726ba90e21f0d735c8b9eae292d1 6e917dee685ce2d93d1d11c50e8f5683` |

---

[← All algorithms](../README.md)
