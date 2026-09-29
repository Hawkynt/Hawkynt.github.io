# Neural Network Compression (Educational)

> Online-trained two-layer neural predictor (backprop through a tanh hidden layer) driving a binary arithmetic coder, NNCP-style. The network learns as it compresses; the decoder replays the identical learning trajectory, so no weights are transmitted.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Neural Network |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Educational Implementation |
| Year | 2019 |
| Origin | 🌐 International |
| Source | [`algorithms/compression/neural-compression.js`](../../../algorithms/compression/neural-compression.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Neural Data Compression](https://arxiv.org/abs/1811.01057)
- [Prediction by Partial Matching](https://en.wikipedia.org/wiki/Prediction_by_partial_matching)
- [Context Modeling](https://compression.ru/download/articles/context/cm_1.pdf)

## References

- [Neural Networks](https://en.wikipedia.org/wiki/Neural_network)
- [Adaptive Compression](https://en.wikipedia.org/wiki/Adaptive_compression)
- [Predictive Coding](https://en.wikipedia.org/wiki/Predictive_coding)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://arxiv.org/abs/1811.01057)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte](https://en.wikipedia.org/wiki/Neural_network)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `010000003d00` |

**Vector 3** — [Simple repetition](https://en.wikipedia.org/wiki/Prediction_by_partial_matching)

| Field | Value |
| --- | --- |
| `input` | `4141` |
| `expected` | `020000003d0c` |

**Vector 4** — [Pattern recognition](https://compression.ru/download/articles/context/cm_1.pdf)

| Field | Value |
| --- | --- |
| `input` | `61626361` |
| `expected` | `040000005beb2c4a` |

---

[← All algorithms](../README.md)
