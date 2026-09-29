# SKINNY-AEAD-M2

> SKINNY-AEAD variant using SKINNY-128-384 with 128-bit key, 96-bit nonce, and 128-bit tag. Optimized for shorter nonces.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Authenticated Encryption |
| Variant | 2 |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Beierle, Jean, Kölbl, Leander, Moradi, Peyrin, Sasaki, Sasdrich, Sim |
| Year | 2019 |
| Origin | 🌐 International |
| Source | [`algorithms/aead/skinny-aead.js`](../../../algorithms/aead/skinny-aead.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Nonce sizes | 12 bytes (96 bits) |
| Tag sizes | 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | No |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [SKINNY-AEAD Specification](https://sites.google.com/site/skinnycipher/home)
- [NIST LWC Submission](https://csrc.nist.gov/projects/lightweight-cryptography)
- [Reference Implementation](https://github.com/rweather/lightweight-crypto)

## References

- [SKINNY Paper (CRYPTO 2016)](https://eprint.iacr.org/2016/660)
- [SKINNY Official Website](https://sites.google.com/site/skinnycipher/)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [SKINNY-AEAD-M2 Official Test Vector #1](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-AEAD-M2.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b` |
| `aad` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `b9e76fc4d90272ff24e6386bf522cfe3` |

---

[← All algorithms](../README.md)
