# DNA Sequence Compression

> 2-bit packing for the four canonical DNA nucleotide symbols (A, C, G, T), four symbols per byte, giving 4:1 on pure nucleotide data. Bytes outside that alphabet are recorded in an exception list (position plus original value) and packed as a placeholder code, so arbitrary byte streams still round-trip exactly. Byte-for-byte identical to CompressionWorkbench's BB_Dna reference block.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Bioinformatics |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | W. James Kent (UCSC 2bit format) |
| Year | 2002 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/dna-compression.js`](../../../algorithms/compression/dna-compression.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [UCSC 2bit Sequence Format](https://genome.ucsc.edu/FAQ/FAQformat.html#format7)
- [FASTA Format Spec](https://en.wikipedia.org/wiki/FASTA_format)

## References

- [BioPython DNA Tools](https://biopython.org/)
- [Genomic Data Compression Survey](https://doi.org/10.1093/bioinformatics/btu513)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty DNA sequence](https://genome.ucsc.edu/FAQ/FAQformat.html#format7)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `0000000000000000` |

**Vector 2** — [Basic nucleotides - 2-bit encoding](https://doi.org/10.1093/bioinformatics/btu513)

| Field | Value |
| --- | --- |
| `input` | `41434754` |
| `expected` | `04000000000000001b` |

**Vector 3** — [Simple nucleotide sequence](https://en.wikipedia.org/wiki/FASTA_format)

| Field | Value |
| --- | --- |
| `input` | `414347544743` |
| `expected` | `06000000000000001b90` |

**Vector 4** — [Ambiguity code N escaped through the exception list](https://genome.ucsc.edu/FAQ/FAQformat.html#format7)

| Field | Value |
| --- | --- |
| `input` | `414347544e414347544e` |
| `expected` | `0a00000002000000040000004e090000004e1b06c0` |

---

[← All algorithms](../README.md)
