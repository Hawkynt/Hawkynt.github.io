# SOSEMANUK

> ARX-based stream cipher combining SNOW-like LFSR with Serpent S-boxes. eSTREAM Profile 1 finalist with 128/256-bit keys and 128-bit IV. Designed for high software performance.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | eSTREAM Stream Cipher |
| Security status | 🛡️ Secure |
| Complexity | Expert |
| Inventor | C. Berbain, O. Billet, A. Canteaut, N. Courtois, B. Debraize, H. Gilbert, L. Goubin, A. Gouget, L. Granboulan, C. Lauradoux, M. Minier, T. Pornin, H. Sibert |
| Year | 2005 |
| Origin | 🇫🇷 France |
| Source | [`algorithms/stream/sosemanuk.js`](../../../algorithms/stream/sosemanuk.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) to 32 bytes (256 bits) |
| Nonce sizes | 16 bytes (128 bits) |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [eSTREAM SOSEMANUK Specification](http://www.ecrypt.eu.org/stream/sosemanuken.html)
- [SOSEMANUK Paper](https://www.di.ens.fr/~fouque/pub/fse05.pdf)
- [Wikipedia: SOSEMANUK](https://en.wikipedia.org/wiki/SOSEMANUK)

## References

- [libestream C Reference (eSTREAM Profile 1 ciphers)](https://github.com/lvella/libestream)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — SOSEMANUK Test Vector 1 - All zeros

Source: eSTREAM specification test

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `3333333333333333` |

---

[← All algorithms](../README.md)
