# Tiger

> Tiger is a 192-bit cryptographic hash function designed by Ross Anderson and Eli Biham in 1995 for efficiency on 64-bit platforms. Three passes of eight rounds mix a 512-bit block through four published 64-bit S-boxes.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Classical Hash |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Ross Anderson, Eli Biham |
| Year | 1995 |
| Origin | 🌐 International |
| Source | [`algorithms/hash/tiger.js`](../../../algorithms/hash/tiger.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 24 bytes (192 bits) |
| Hash sizes | 24 bytes (192 bits) |

## Security

**Status:** not classified — treat as unverified.

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Reduced-round collisions | Collisions are known for Tiger reduced to 19 of its 24 rounds; full Tiger has no published practical break, but newer designs are preferred for new work. | — |

## Documentation

- [Tiger: A Fast New Hash Function](https://www.cs.technion.ac.il/~biham/Reports/Tiger/tiger/tiger.html)
- [Tiger paper (Fast Software Encryption 3, 1996)](https://www.cl.cam.ac.uk/~rja14/Papers/tiger.pdf)

## References

- [Tiger reference S-boxes](https://www.cs.technion.ac.il/~biham/Reports/Tiger/sboxes.c)
- [NESSIE-format test vectors](https://www.cs.technion.ac.il/~biham/Reports/Tiger/test-vectors-nessie-format.dat)
- [Wikipedia: Tiger (hash function)](https://en.wikipedia.org/wiki/Tiger_(hash_function))

## Test vectors

14 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NESSIE set 1 vector 0 - empty string](https://www.cs.technion.ac.il/~biham/Reports/Tiger/test-vectors-nessie-format.dat)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `3293ac630c13f0245f92bbb1766e16167a4e58492dde73f3` |

**Vector 2** — [NESSIE set 1 vector 1 - 'a'](https://www.cs.technion.ac.il/~biham/Reports/Tiger/test-vectors-nessie-format.dat)

| Field | Value |
| --- | --- |
| `input` | `61` |
| `expected` | `77befbef2e7ef8ab2ec8f93bf587a7fc613e247f5f247809` |

**Vector 3** — [NESSIE set 1 vector 2 - 'abc'](https://www.cs.technion.ac.il/~biham/Reports/Tiger/test-vectors-nessie-format.dat)

| Field | Value |
| --- | --- |
| `input` | `616263` |
| `expected` | `2aab1484e8c158f2bfb8c5ff41b57a525129131c957b5f93` |

**Vector 4** — [NESSIE set 1 vector 3 - 'message digest'](https://www.cs.technion.ac.il/~biham/Reports/Tiger/test-vectors-nessie-format.dat)

| Field | Value |
| --- | --- |
| `input` | `6d65737361676520646967657374` |
| `expected` | `d981f8cb78201a950dcf3048751e441c517fca1aa55a29f6` |

**Vector 5** — [NESSIE set 1 vector 4 - 'abcdefghijklmnopqrstuvwxyz'](https://www.cs.technion.ac.il/~biham/Reports/Tiger/test-vectors-nessie-format.dat)

| Field | Value |
| --- | --- |
| `input` | `6162636465666768696a6b6c6d6e6f707172737475767778797a` |
| `expected` | `1714a472eee57d30040412bfcc55032a0b11602ff37beee9` |

**Vector 6** — [NESSIE set 1 vector 5 - 56-byte 'abcdbcde...nopq'](https://www.cs.technion.ac.il/~biham/Reports/Tiger/test-vectors-nessie-format.dat)

| Field | Value |
| --- | --- |
| `input` | `61626364626364656364656664656667 65666768666768696768696a68696a6b 696a6b6c6a6b6c6d6b6c6d6e6c6d6e6f 6d6e6f706e6f7071` |
| `expected` | `0f7bf9a19b9c58f2b7610df7e84f0ac3a71c631e7b53f78e` |

**Vector 7** — [NESSIE set 1 vector 7 - 80-byte '1234567890' repeated eight times](https://www.cs.technion.ac.il/~biham/Reports/Tiger/test-vectors-nessie-format.dat)

| Field | Value |
| --- | --- |
| `input` | `31323334353637383930313233343536 37383930313233343536373839303132 33343536373839303132333435363738 39303132333435363738393031323334 35363738393031323334353637383930` |
| `expected` | `1c14795529fd9f207a958f84c52f11e887fa0cabdfd91bfd` |

**Vector 8** — [NESSIE set 2 vector 8 - one zero byte](https://www.cs.technion.ac.il/~biham/Reports/Tiger/test-vectors-nessie-format.dat)

| Field | Value |
| --- | --- |
| `input` | `00` |
| `expected` | `5d9ed00a030e638bdb753a6a24fb900e5a63b8e73e6c25b6` |

**Vector 9** — [NESSIE set 2 vector 440 - 55 zero bytes, last length that fits one block](https://www.cs.technion.ac.il/~biham/Reports/Tiger/test-vectors-nessie-format.dat)

| Field | Value |
| --- | --- |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000` |
| `expected` | `a4ee394b2a208e9b0a74c6d57568e470f6e658c44689fc63` |

**Vector 10** — [NESSIE set 2 vector 448 - 56 zero bytes, first length needing a second block](https://www.cs.technion.ac.il/~biham/Reports/Tiger/test-vectors-nessie-format.dat)

| Field | Value |
| --- | --- |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 0000000000000000` |
| `expected` | `19208aef976eea1a1296ab46bb8519e4e35cc3d26d2b574f` |

**Vector 11** — [NESSIE set 2 vector 504 - 63 zero bytes, one under the block size](https://www.cs.technion.ac.il/~biham/Reports/Tiger/test-vectors-nessie-format.dat)

| Field | Value |
| --- | --- |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 000000000000000000000000000000` |
| `expected` | `a857dd168b22b65a6dd2ea8035c4edc4b890453d14ba6052` |

**Vector 12** — [NESSIE set 2 vector 512 - 64 zero bytes, exactly the block size](https://www.cs.technion.ac.il/~biham/Reports/Tiger/test-vectors-nessie-format.dat)

| Field | Value |
| --- | --- |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `33ff9966ddd692427a9bc4d611f3c74cf629a0544a1a7ed7` |

**Vector 13** — [NESSIE set 2 vector 520 - 65 zero bytes, one over the block size](https://www.cs.technion.ac.il/~biham/Reports/Tiger/test-vectors-nessie-format.dat)

| Field | Value |
| --- | --- |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00` |
| `expected` | `759d79778fa748f8e828a568c45b7e2774a6052e0a4a06a7` |

**Vector 14** — [NESSIE set 2 vector 1016 - 127 zero bytes, two blocks plus padding block](https://www.cs.technion.ac.il/~biham/Reports/Tiger/test-vectors-nessie-format.dat)

| Field | Value |
| --- | --- |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 000000000000000000000000000000` |
| `expected` | `00a569ccadb17662483ca36230bcc6956ba5c1d5595c044a` |

---

[← All algorithms](../README.md)
