# Mercy

> Paul Crowley's tweakable block cipher designed for disk sector encryption. Features unusually large 4096-bit (512-byte) blocks with 128-bit tweak parameter for sector addressing. Uses 6-round Feistel network with key-dependent state machine.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | ❌ Broken |
| Complexity | Advanced |
| Inventor | Paul Crowley |
| Year | 2000 |
| Origin | Not specified |
| Source | [`algorithms/block/mercy.js`](../../../algorithms/block/mercy.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 512 bytes (4096 bits) |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Differential Cryptanalysis](https://www.iacr.org/archive/fse2001/) | Broken by Scott Fluhrer at FSE 2001 with differential attack across all six rounds | — |

## Documentation

- [Mercy Specification](http://www.ciphergoth.org/crypto/mercy/)
- [FSE 2000 Paper](https://link.springer.com/chapter/10.1007/3-540-44706-7_4)
- [Mercy on Crypto Wiki](https://cryptography.fandom.com/wiki/Mercy_(cipher))

## References

- [Paul Crowley's Cryptography](https://www.ciphergoth.org/)
- [FSE 2000 Proceedings](https://link.springer.com/book/10.1007/3-540-44706-7)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Mercy all-zeros test with zero key and tweak

Source: Implementation-derived test vector (round-trip validated)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `tweak` | `00000000000000000000000000000000` |
| `roundTrip` | Yes |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 …` (512 bytes; the full value is in the source) |
| `expected` | `406e45494bece167e520d9dcee31c9a2 c4422ad833f47e73a4d2133f0ceda06f 3c77bda3b4de72f0fa740a668836a030 1736e2af6a24a928a370bd4c246e0502 …` (512 bytes; the full value is in the source) |

**Vector 2** — Mercy incremental input pattern

Source: Implementation-derived test vector (round-trip validated)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `tweak` | `fedcba9876543210fedcba9876543210` |
| `roundTrip` | Yes |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f …` (512 bytes; the full value is in the source) |
| `expected` | `873a7c5888a267be835ff946630849af d73b64c6ca8bf7168cd2acb0b3c917fb bf7728c4147d1cd9982a4baf11a36bbc 42762c4deb30c16b0823b47bc6c79eee …` (512 bytes; the full value is in the source) |

**Vector 3** — Mercy with 0x55 pattern and non-zero tweak

Source: Implementation-derived test vector (round-trip validated)

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdef0123456789abcdef` |
| `tweak` | `0f0e0d0c0b0a09080706050403020100` |
| `roundTrip` | Yes |
| `input` | `55555555555555555555555555555555 55555555555555555555555555555555 55555555555555555555555555555555 55555555555555555555555555555555 …` (512 bytes; the full value is in the source) |
| `expected` | `fc71cf4407ddadf52b8705483e1451e8 520594b10db497c900f4db40df081908 c6df8bd904b991dc55cad4b85b4407a6 099fb73ccf64c6a1a4af38f9b15cc5d2 …` (512 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
