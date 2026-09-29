# SHARK

> SHARK is a 64-bit block cipher using S-box and MDS matrix transformations over GF(2^8). Designed in 1996, it features variable rounds (default 6) with a 128-bit key and incorporates provable security against differential and linear cryptanalysis through its maximum distance separable (MDS) matrix design.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Vincent Rijmen, Joan Daemen, Bart Preneel, Anton Bosselaers, Erik De Win |
| Year | 1996 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/block/shark.js`](../../../algorithms/block/shark.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🧪 Experimental

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Limited Rounds | With only 6 rounds by default, SHARK has less security margin than modern ciphers like AES which uses 10-14 rounds. | — |
| Small Block Size | 64-bit blocks are vulnerable to birthday attacks after processing 2^32 blocks (~32GB). | — |
| Historical Design | SHARK predates AES and has received less cryptanalysis than modern standards. | — |

## Documentation

- [SHARK Specification](https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/shark.zip)
- [Crypto++ Implementation](https://www.cryptopp.com/wiki/SHARK)
- [Rijndael Predecessors](https://en.wikipedia.org/wiki/Advanced_Encryption_Standard#Development)

## References

- [COSIC Research Group](https://www.esat.kuleuven.be/cosic/)
- [Block Cipher Design Principles](https://csrc.nist.gov/publications/detail/sp/800-38a/final)
- [MDS Matrix Theory](https://en.wikipedia.org/wiki/MDS_matrix)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Crypto++ Test Vector #1 (Zero Key/Plaintext)](https://github.com/weidai11/cryptopp/blob/master/TestData/sharkval.dat)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `214bcf4e7716420a` |

**Vector 2** — [Crypto++ Test Vector #2 (Sequential Key)](https://github.com/weidai11/cryptopp/blob/master/TestData/sharkval.dat)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `0000000000000000` |
| `expected` | `c76c696289898137` |

**Vector 3** — [Crypto++ Test Vector #3 (Round-trip)](https://github.com/weidai11/cryptopp/blob/master/TestData/sharkval.dat)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `c76c696289898137` |
| `expected` | `077a4a59faeeea4d` |

**Vector 4** — [Crypto++ Test Vector #4](https://github.com/weidai11/cryptopp/blob/master/TestData/sharkval.dat)

| Field | Value |
| --- | --- |
| `key` | `915f4619be41b2516355a50110a9ce91` |
| `input` | `21a5dbee154b8f6d` |
| `expected` | `6ff33b98f448e95a` |

**Vector 5** — [Crypto++ Test Vector #5](https://github.com/weidai11/cryptopp/blob/master/TestData/sharkval.dat)

| Field | Value |
| --- | --- |
| `key` | `783348e75aeb0f2fd7b169bb8dc16787` |
| `input` | `f7c013ac5b2b8952` |
| `expected` | `e5e554abe9ced2d2` |

**Vector 6** — [Crypto++ Test Vector #6](https://github.com/weidai11/cryptopp/blob/master/TestData/sharkval.dat)

| Field | Value |
| --- | --- |
| `key` | `dc49db1375a5584f6485b413b5f12baf` |
| `input` | `2f42b3b70369fc92` |
| `expected` | `9ae068313f343a7a` |

**Vector 7** — [Crypto++ Test Vector #7](https://github.com/weidai11/cryptopp/blob/master/TestData/sharkval.dat)

| Field | Value |
| --- | --- |
| `key` | `5269f149d41ba0152497574d7f153125` |
| `input` | `65c178b284d197cc` |
| `expected` | `d3f111a282f17f29` |

---

[← All algorithms](../README.md)
