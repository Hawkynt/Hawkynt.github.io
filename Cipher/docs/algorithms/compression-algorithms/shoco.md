# Shoco

> Short string compression optimized for English text using a trained character alphabet and successor-rank prediction, packed via Shoco's real multi-tier bit layout (1-/2-/4-byte packs with a unary tier header).

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Statistical |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Christian Schramm (Ed-von-Schleck) |
| Year | 2014 |
| Origin | 🇩🇪 Germany |
| Source | [`algorithms/compression/shoco.js`](../../../algorithms/compression/shoco.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Shoco GitHub Repository](https://github.com/Ed-von-Schleck/shoco)
- [Shoco Official Website](https://ed-von-schleck.github.io/shoco/)
- [MIT License](https://github.com/Ed-von-Schleck/shoco/blob/master/LICENSE)

## References

- [Shoco source (pack tiers, decode_header)](https://github.com/Ed-von-Schleck/shoco/blob/master/shoco.c)
- [Shoco default model (packs[] table shape)](https://github.com/Ed-von-Schleck/shoco/blob/master/shoco_model.h)
- [Entropy Encoding](https://en.wikipedia.org/wiki/Entropy_encoding)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty string compression](https://github.com/Ed-von-Schleck/shoco)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single word 'test'](https://github.com/Ed-von-Schleck/shoco)

| Field | Value |
| --- | --- |
| `input` | `74657374` |
| `expected` | `04000000c579` |

**Vector 3** — [Word 'compression' - validates multi-pack encoding](https://github.com/Ed-von-Schleck/shoco)

| Field | Value |
| --- | --- |
| `input` | `636f6d7072657373696f6e` |
| `expected` | `0b00000063e329d1f798` |

**Vector 4** — [Phrase 'test compression' - validates multiple packs and a literal space](https://github.com/Ed-von-Schleck/shoco)

| Field | Value |
| --- | --- |
| `input` | `7465737420636f6d7072657373696f6e` |
| `expected` | `10000000c5792063e329d1f798` |

---

[← All algorithms](../README.md)
