# Sequitur

> Online grammar inference by Nevill-Manning and Witten: as each symbol is appended the algorithm enforces digram uniqueness (no adjacent pair occurs twice anywhere in the grammar) and rule utility (every non-start rule is referenced more than once), producing a straight-line grammar in linear time. Repeated phrases collapse into rules and repeated sequences of rules collapse in turn, so heavily repetitive input ends up as a handful of rules plus a very short start sequence. The grammar is bit-packed with no follow-on entropy coding.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Craig G. Nevill-Manning, Ian H. Witten |
| Year | 1997 |
| Origin | Not specified |
| Source | [`algorithms/compression/sequitur.js`](../../../algorithms/compression/sequitur.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Nevill-Manning and Witten, Identifying Hierarchical Structure in Sequences (JAIR 7, 1997)](https://www.jair.org/index.php/jair/article/view/10151)
- [Wikipedia - Sequitur algorithm](https://en.wikipedia.org/wiki/Sequitur_algorithm)
- [Sequitur project page](http://www.sequitur.info/)

## References

- [Nevill-Manning and Witten, Compression and Explanation Using Hierarchical Grammars (The Computer Journal 40, 1997)](https://academic.oup.com/comjnl/article/40/2_and_3/103/450969)
- [Wikibooks - Data Compression/Dictionary compression](https://en.wikibooks.org/wiki/Data_Compression/Dictionary_compression)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input - only the 4-byte little-endian length header](https://www.jair.org/index.php/jair/article/view/10151)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte 0x41 - no rules, a one-symbol start sequence stored as a plain byte](https://www.jair.org/index.php/jair/article/view/10151)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `0100000000a080` |

**Vector 3** — [Four identical bytes - the digram 'aa' becomes rule 0 and the start sequence is that rule twice](https://en.wikipedia.org/wiki/Sequitur_algorithm)

| Field | Value |
| --- | --- |
| `input` | `61616161` |
| `expected` | `0400000001a3098680` |

**Vector 4** — [Long repetitive run - 256 copies of 0x61 collapse into a doubling hierarchy of 7 rules](https://en.wikipedia.org/wiki/Sequitur_algorithm)

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161` |
| `expected` | `0001000007fea66aaef3377b8c261880` |

**Vector 5** — [Alternating two-byte pattern - 32 repetitions of 'ab' collapse into 5 rules](https://en.wikipedia.org/wiki/Sequitur_algorithm)

| Field | Value |
| --- | --- |
| `input` | `61626162616261626162616261626162 61626162616261626162616261626162 61626162616261626162616261626162 61626162616261626162616261626162` |
| `expected` | `4000000005fa99aabbcc3098a200` |

**Vector 6** — [ASCII text - 'the quick brown fox jumps over the lazy dog. ' repeated four times folds into 4 rules](https://www.jair.org/index.php/jair/article/view/10151)

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 206a756d7073206f7665722074686520 6c617a7920646f672e20746865207175 69636b2062726f776e20666f78206a75 6d7073206f76657220746865206c617a 7920646f672e2074686520717569636b 2062726f776e20666f78206a756d7073 206f76657220746865206c617a792064 6f672e20` |
| `expected` | `b400000004704731d0d065106e713a9a 4c66b10188e46f3b9b84066379e0406a 3a9b4e073101bcec6539736184f47910 190de67170824b6e1000` |

**Vector 7** — [Pseudo-random binary sample - no repeated digram, so no rule is ever created](https://en.wikipedia.org/wiki/Sequitur_algorithm)

| Field | Value |
| --- | --- |
| `input` | `d3b07a1c8f4e2b6905c1fd3846a70e92` |
| `expected` | `10000000000869d83d0e47a715b482e0fe9c2353874900` |

**Vector 8** — [All 256 byte values 0x00..0xFF - no repeated digram, so the start sequence is the input itself](https://en.wikipedia.org/wiki/Sequitur_algorithm)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `00010000000080000081018202830384 04850586068707880889098a0a8b0b8c 0c8d0d8e0e8f0f901091119212931394 14951596169717981899199a1a9b1b9c …` (264 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
