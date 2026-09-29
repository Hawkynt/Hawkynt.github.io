# BLAKE-256

> BLAKE-256 hash function from SHA-3 competition. Produces 256-bit (32-byte) hash values.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Cryptographic Hash |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Jean-Philippe Aumasson, Luca Henzen, Willi Meier, Raphael C.-W. Phan |
| Year | 2008 |
| Origin | 🇨🇭 Switzerland |
| Source | [`algorithms/hash/blake.js`](../../../algorithms/hash/blake.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [BLAKE Paper](https://www.aumasson.jp/blake/blake.pdf)
- [SHA-3 Competition](https://csrc.nist.gov/projects/hash-functions/sha-3-project)
- [Noble Hashes Implementation](https://github.com/paulmillr/noble-hashes)

## References

- [BLAKE reference implementation (Jean-Philippe Aumasson)](https://github.com/veorq/BLAKE)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty string vector](https://github.com/paulmillr/noble-hashes/blob/main/test/blake.test.ts)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `716f6e863f744b9ac22c97ec7b76ea5f5908bc5b2f67c61510bfc4751384ea7a` |

**Vector 2** — [BLAKE test vector](https://github.com/paulmillr/noble-hashes/blob/main/test/blake.test.ts)

| Field | Value |
| --- | --- |
| `input` | `424c414b45` |
| `expected` | `07663e00cf96fbc136cf7b1ee099c95346ba3920893d18cc8851f22ee2e36aa6` |

**Vector 3** — [Quick brown fox](https://github.com/paulmillr/noble-hashes/blob/main/test/blake.test.ts)

| Field | Value |
| --- | --- |
| `input` | `54686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f67` |
| `expected` | `7576698ee9cad30173080678e5965916adbb11cb5245d386bf1ffda1cb26c9d7` |

**Vector 4** — [NIST SHA-3 Round 3 KAT, Len = 440 (padding boundary, 55 mod 64)](https://web.archive.org/web/20110605051750id_/http://csrc.nist.gov/groups/ST/hash/sha-3/Round3/documents/Blake_FinalRnd.zip)

| Field | Value |
| --- | --- |
| `input` | `de286ba4206e8b005714f80fb1cdfaeb de91d29f84603e4a3ebc04686f99a46c 9e880b96c574825582e8812a26e5a857 ffc6579f63742f` |
| `expected` | `ad373db6defaefbeeff69e78e220a4ca9ef510ad5f85f0c698a749e0e6dcaeb5` |

---

[← All algorithms](../README.md)
