# SHX (Serpent Extended)

> Extended Serpent cipher with 256/512/1024-bit keys from CEX library. Educational implementation with increased rounds (40/48/64) for enhanced security margins.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Extended Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | John Underhill (CEX) |
| Year | 2018 |
| Origin | 🇨🇦 Canada |
| Source | [`algorithms/block/shx.js`](../../../algorithms/block/shx.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits); 64 bytes (512 bits); 128 bytes (1024 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Extended Cipher Analysis | Extended versions of standard ciphers may have different security properties | Use only for educational purposes and research into extended cipher designs |

## Documentation

- [CEX Cryptographic Library](https://github.com/QRCS-CORP/CEX)
- [Original Serpent Specification](https://www.cl.cam.ac.uk/~rja14/serpent.html)
- [RFC 5869: HKDF Specification](https://tools.ietf.org/html/rfc5869)

## References

- [CEX Extended Serpent Reference](https://github.com/QRCS-CORP/CEX/tree/master/CEX/Cipher/Block/Mode)
- [Extended Block Cipher Design Principles](https://eprint.iacr.org/2016/1176.pdf)
- [NIST Post-Quantum Cryptography](https://csrc.nist.gov/Projects/Post-Quantum-Cryptography)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [SHX 256-bit key test vector](https://github.com/QRCS-CORP/CEX)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `380fb7897f9c7c2d4f88a36df031dc93` |

**Vector 2** — [SHX 512-bit key test vector](https://github.com/QRCS-CORP/CEX)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `01010101010101010101010101010101` |
| `expected` | `d6a065a5a52d5c9d307a5be514c884dc` |

---

[← All algorithms](../README.md)
