# Delta + RLE

> Difference-based transform (stores differences between consecutive values) followed by run-length encoding of the delta stream, so unlike the pure delta filter this actually compresses. Effective for data with small variations like audio samples, image gradients, or time series, and for long runs of a constant or steadily-changing value. See 'Delta Filter' for the non-compressing, size-preserving variant.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Transform |
| Security status | Not classified |
| Complexity | Not specified |
| Inventor | Various (general technique) |
| Year | 1950 |
| Origin | ❓ Unknown |
| Source | [`algorithms/compression/delta.js`](../../../algorithms/compression/delta.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Delta Encoding - Wikipedia](https://en.wikipedia.org/wiki/Delta_encoding)
- [PNG Delta Filters](http://libpng.org/pub/png/spec/1.2/PNG-Filters.html)
- [Time Series Compression](https://www.vldb.org/pvldb/vol8/p1816-pelkonen.pdf)

## References

- [PNG Reference Implementation](http://libpng.org/pub/png/libpng.html)
- [TIFF Differencing Predictor](https://www.adobe.io/open/standards/TIFF.html)
- [InfluxDB Time Series Delta](https://docs.influxdata.com/influxdb/v1.8/concepts/storage_engine/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Empty data test

Source: Edge case test

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — Single byte test

Source: Minimal delta test

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `41` |

**Vector 3** — [Incrementing sequence - ideal for delta compression](https://en.wikipedia.org/wiki/Delta_encoding)

| Field | Value |
| --- | --- |
| `input` | `0a0c0e10` |
| `expected` | `0aff0302` |

---

[← All algorithms](../README.md)
