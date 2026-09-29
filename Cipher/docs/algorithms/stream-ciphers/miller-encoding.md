# Miller Encoding

> Educational implementation of Miller encoding adapted as a stream cipher. Miller encoding is a line code where data bits are encoded with clock transitions for synchronization, adapted here for cryptographic demonstration.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Miller et al. |
| Year | 1963 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/stream/miller.js`](../../../algorithms/stream/miller.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 1 byte (8 bits) to 256 bytes (2048 bits) |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Miller Encoding](https://en.wikipedia.org/wiki/Differential_Manchester_encoding)
- [Line Codes](https://en.wikipedia.org/wiki/Line_code)

## References

- [sigrok Miller/Modified Miller Protocol Decoder](https://github.com/sigrokproject/libsigrokdecode/blob/master/decoders/miller/pd.py)
- [sigrok Miller Decoder Documentation](https://sigrok.org/wiki/Protocol_decoder:Miller)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Miller Encoding Test Vector

Source: Reference implementation output

| Field | Value |
| --- | --- |
| `key` | `00010203040506070809101112131415` |
| `input` | `0001020304050607` |
| `expected` | `1808021206120212` |

---

[← All algorithms](../README.md)
