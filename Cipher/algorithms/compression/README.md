# Compression Algorithms

This directory contains implementations of various data compression algorithms. The following comprehensive list includes algorithms researched from multiple Wikipedia sources (English, German, Chinese, Russian, Japanese, Arabic).

## Implemented Algorithms

<!-- BEGIN GENERATED ALGORITHM LIST -->

Generated from the registry by `tools/refresh-readmes.js`.

- **ACE (WinAce)** (`ace-archiver.js`) - WinAce's ACE 1.0 method: an LZ77 matcher over a 32 KiB dictionary feeding two per-block Huffman trees, a 284-symbol main tree of literals, an end-of-block marker and 27 match-length slots whose code lengths travel through a 19-symbol pre-tree, plus a 2-bit distance mode selecting either an explicit 15-bit distance or one of three recent distances
- **Adaptive Huffman (FGK)** (`adaptive-huffman.js`) - Faller-Gallager-Knuth dynamic Huffman coding
- **aPLib** (`aplib.js`) - Joergen Ibsen's LZSS-based compression library, known for very small and fast decompressors
- **Arithmetic Coding** (`arithmetic.js`) - Arithmetic coding represents the entire message as a single fraction in the range [0,1) using probability models
- **ARJ** (`arj.js`) - ARJ method 1: LZSS matching over a 26624-byte window with match lengths 3 to 256, feeding a 510-symbol literal/length Huffman tree and a 17-slot position tree rebuilt for every block of at most 16384 tokens
- **BALZ** (`balz.js`) - ROLZ (reduced-offset Lempel-Ziv) compressor by Ilya Muravyov: matches are drawn from a 64-entry table selected by the previous byte, so only a slot index is transmitted, and every bit is coded by a 12-bit adaptive binary arithmetic coder
- **BCJ ARM** (`bcj-arm.js`) - Branch/Call/Jump filter for 32-bit ARM (A32) machine code
- **BCJ ARM-Thumb** (`bcj-arm-thumb.js`) - Branch/Call/Jump filter for 16-bit ARM Thumb (T32) machine code
- **BCJ ARM64** (`bcj-arm64.js`) - Branch/Call/Jump filter for AArch64 (ARM64) machine code
- **BCJ IA-64** (`bcj-ia64.js`) - Branch/Call/Jump filter for Itanium (IA-64) machine code
- **BCJ PowerPC** (`bcj-powerpc.js`) - Branch/Call/Jump filter for big-endian PowerPC machine code
- **BCJ RISC-V** (`bcj-riscv.js`) - Branch/Call/Jump filter for RISC-V machine code
- **BCJ SPARC** (`bcj-sparc.js`) - Branch/Call/Jump filter for big-endian SPARC machine code
- **BCJ x86** (`bcj-x86.js`) - Branch/Call/Jump filter for 32/64-bit x86 machine code
- **BCM (Block Context Mixing)** (`bcm.js`) - Burrows-Wheeler Transform with a compact order-0..2 context-mixing back end, BCM-style
- **BriefLZ** (`brieflz.js`) - Byte-for-byte port of CompressionWorkbench's clean-room BriefLZ building block: byte-oriented LZ77 with a single tag bit per token (0=literal, 1=match) and Elias-gamma coded match length/offset, matched via a 3-byte multiplicative hash chain
- **Brotli** (`brotli.js`) - RFC 7932-compatible Brotli codec
- **BSC (Block Sorting Compression)** (`bsc.js`) - Burrows-Wheeler Transform, Move-to-Front recoding, and an LZMA-style adaptive bit-tree entropy stage (two trees selected by whether the previous rank was zero)
- **BWT (Burrows-Wheeler Transform)** (`bwt.js`) - Reversible data transformation that rearranges string characters to improve performance of other compression techniques
- **BWT-Advanced (Enhanced Burrows-Wheeler Transform)** (`bwt-advanced.js`) - Advanced block-sorting compression using enhanced Burrows-Wheeler Transform with optimal suffix array construction, intelligent post-processing, and multi-stage entropy coding for maximum compression efficiency
- **Byte-Pair Encoding (BPE)** (`bpe.js`) - Iteratively replaces the most frequently occurring byte pairs with unused byte values
- **BZIP2** (`bzip2.js`) - Block-sorting compression using Burrows-Wheeler Transform, Move-to-Front coding, Run-Length Encoding, and Huffman coding
- **CMIX** (`cmix.js`) - Reduced context-mixing model set (hashed orders 0,1,2,3,4,6 plus a word context and a match model, mixed by one logistic-domain mixer with two chained SSE stages)
- **Context Predictor (order-2/1/0)** (`ctw.js`) - Most-frequent-symbol predictor over an order-2/1/0 byte context hierarchy with a hit/miss bitmap
- **Context Tree Weighting (Willems)** (`ctw-willems.js`) - Genuine Context Tree Weighting (Willems/Shtarkov/Tjalkens): a depth-16 binary context tree with a Krichevsky-Trofimov estimator per node, recursively weighted between each node's own estimate and the product of its children, driving a binary arithmetic coder
- **Crush** (`crush.js`) - Fast LZ77 coder by Ilya Muravyov
- **CSC (Context Sorting Compression)** (`csc.js`) - LZ77 parsing (hash-chain match finder, 32 KiB window, 3-258 byte matches) whose flag/literal/length/distance channels are entropy-coded with logistic-domain context mixing over a shared binary arithmetic coder
- **DEFLATE** (`deflate.js`) - Industry-standard lossless compression combining LZ77 and Huffman coding
- **Deflate64** (`deflate64.js`) - Enhanced DEFLATE (ZIP compression method 9) with a 64KB sliding window, distance codes up to 65536, and a 16-bit extended length code reaching matches up to 65538 bytes
- **Delta + RLE** (`delta.js`) - Difference-based transform (stores differences between consecutive values) followed by run-length encoding of the delta stream, so unlike the pure delta filter this actually compresses
- **Delta Filter** (`delta-filter.js`) - Pure, size-preserving delta transform: each byte is stored as the difference from the byte a fixed distance behind it (distance=1 here), with no entropy coding or run-length pass
- **Density (Chameleon)** (`density.js`) - Predictive 4-byte-chunk dictionary coder: a hash of the previous chunk predicts the next one, and a correct prediction costs zero payload bytes - only a signature bit
- **DMC** (`dmc.js`) - Dynamic Markov Compression
- **DNA Sequence Compression** (`dna-compression.js`) - 2-bit packing for the four canonical DNA nucleotide symbols (A, C, G, T), four symbols per byte, giving 4:1 on pure nucleotide data
- **DoubleSpace** (`doublespace.js`) - MS-DOS 6.0/6.2 real-time disk compression codec (DBLSPACE.BIN, SVDC cluster format)
- **DoubleSpace/DriveSpace LZ77** (`ds-lz77-doublespace.js`) - Microsoft DoubleSpace/DriveSpace LZ77 grammar as a standalone building block: variable-bit length and distance codes over a 4KB sliding window, minimum match length 2, greedy hash-chain parse, prefixed by a 4-byte little-endian original-size header
- **DPCM** (`dpcm.js`) - Differential Pulse-Code Modulation, an order-1 predictive transform that stores each sample as its difference (modulo 256) from the immediately preceding sample, with the first sample stored verbatim
- **DriveSpace** (`drivespace.js`) - MS-DOS 6.21/6.22 real-time disk compression codec (DRVSPACE.BIN, JM cluster format)
- **DS-LZ77** (`ds-lz77.js`) - LZSS variant used by the Game Boy Advance and Nintendo DS BIOS decompression routines (type 0x10 header)
- **Elias Delta Coding** (`elias-delta.js`) - Peter Elias improved universal integer encoding, more efficient than Gamma for larger numbers using variable-length prefix codes
- **Elias Gamma Coding** (`elias-gamma.js`) - Peter Elias universal integer encoding optimal for geometric distributions where small values are more frequent
- **Exp-Golomb** (`exp-golomb.js`) - Exponential-Golomb coding, the universal variable-length integer code used for syntax elements in the H.264/AVC and H.265/HEVC video standards
- **FastLZ** (`fastlz.js`) - Portable byte-aligned LZ77 compression optimized for speed
- **Fibonacci Coding** (`fibonacci.js`) - Universal integer encoding using Fibonacci number representation
- **FSE** (`fse.js`) - Finite State Entropy encoding using tANS (tabled Asymmetric Numeral Systems)
- **Golomb** (`golomb.js`) - Golomb coding is a lossless data compression method using prefix codes optimized for geometric distributions
- **Golomb-BitStream** (`golomb-bitstream.js`) - Enhanced Golomb coding using OpCodes.BitStream for optimal prefix coding of geometric distributions
- **Huffman** (`huffman.js`) - Lossless data compression using optimal prefix codes based on symbol frequencies
- **IBM 842** (`ibm842.js`) - Fixed-block dictionary compression built for IBM POWER hardware accelerators
- **Implode** (`implode.js`) - PKWARE DCL/ZIP method 6 (Imploding): an 8K sliding-dictionary LZ77 matcher (minimum match length 3) whose literal, length, and distance-high symbols are entropy-coded with three canonical Huffman trees (a raw distance-low field is sent separately)
- **Levenshtein Coding** (`levenshtein-coding.js`) - Universal prefix code for non-negative integers
- **Lizard** (`lizard.js`) - Efficient compressor with very fast decompression and compression ratios comparable to zip/zlib at fast decompression speed
- **LZ4** (`lz4.js`) - Lossless compression algorithm focused on compression and decompression speed
- **LZ4 Frame** (`lz4-frame.js`) - LZ4 frame format with content size, checksums and multi-block support
- **LZ77** (`lz77.js`) - Dictionary-based compression using sliding window technique
- **LZ77-Optimal** (`lz77-optimal.js`) - LZ77 with cost-based optimal (shortest-path) parsing
- **LZ78 Dictionary Building** (`lz78.js`) - Lempel-Ziv 1978 algorithm builds dictionary of phrases during compression, providing universal compression without sliding window
- **LZAP** (`lzap.js`) - Lempel-Ziv All Prefixes, a derivative of LZMW: after coding a match the dictionary gains the previous match concatenated with every prefix of the current match rather than a single entry, so far fewer codes are emitted at the cost of a rapidly filling dictionary
- **LZAV** (`lzav.js`) - Fast general-purpose in-memory LZ77 compression algorithm
- **LZF** (`lzf.js`) - Original Lempel-Ziv-Free compression by Marc Lehmann
- **LZFSE** (`lzfse.js`) - Apple's Lempel-Ziv Finite State Entropy compression algorithm
- **LZFX** (`lzfx.js`) - Improved LZF variant with better compression ratios while maintaining high speed
- **LZG** (`lzg.js`) - Minimal LZ77-based compression with a deliberately tiny decoder
- **LZH** (`lzh.js`) - LHA/LHarc -lh5- method: LZSS matching over an 8 KiB window feeding two per-block Huffman trees, a 510-symbol literal/length tree whose code lengths travel through a 19-symbol code-length tree, and a slot-based position tree with raw extra bits
- **LZHAM** (`lzham.js`) - LZ77 parsing over 32 KB hash chains (matches of 3 to 258 bytes, at most 64 chain probes) with the literal/length and distance alphabets coded by canonical Huffman codes whose code-length table is written verbatim ahead of the token stream
- **LZJB** (`lzjb.js`) - Fast lossless compression algorithm designed for ZFS filesystem
- **LZMA** (`lzma.js`) - Lempel-Ziv-Markov chain Algorithm
- **LZMAT** (`lzmat.js`) - Real-time compression using match tables instead of hash chains
- **LZMS** (`lzms.js`) - Microsoft's LZ77 compression format, introduced with Windows 8 for the WIM (Windows Imaging Format) archiver and msdelta, succeeding LZX/Xpress-Huffman in that lineage
- **LZMW** (`lzmw.js`) - Miller-Wegman variant of LZW: instead of adding the previous match plus one character, the dictionary gains the concatenation of the previous match and the entire current match, so entries grow by whole matches at a time
- **LZO** (`lzo.js`) - Lempel-Ziv-Oberhumer compression algorithm
- **LZP** (`lzp.js`) - Dictionary compression with context-based prediction using hash tables
- **LZRLE** (`lzrle.js`) - LZO-RLE compression combining LZ77 dictionary-based compression with run-length encoding for zero sequences
- **LZRW1** (`lzrw1.js`) - Extremely fast LZ77-based compression algorithm with hash table dictionary matching
- **LZRW3** (`lzrw3.js`) - Improved LZ77-based compression using hash table index encoding instead of offsets
- **LZS** (`lzs.js`) - Stac Lempel-Ziv-Stac compression as specified for PPP by RFC 1974
- **LZSS** (`lzss.js`) - Lempel-Ziv-Storer-Szymanski compression algorithm
- **LZTURBO** (`lzturbo.js`) - Fast hash-matched LZ77 front end wrapped in a magic/method/length block, modelling LZTURBO's documented outer shape
- **LZVN** (`lzvn.js`) - Byte-oriented opcode LZ77 in the spirit of Apple's fast LZVN codec, with tiered distance encoding
- **LZW (Lempel-Ziv-Welch)** (`lzw.js`) - Dictionary-based compression algorithm that builds a table of frequently occurring strings, starting from a dictionary of all single bytes and adding new patterns dynamically
- **LZWL** (`lzwl.js`) - LZW whose initial dictionary is seeded with the input's most frequent byte digrams (found via an up-front frequency analysis), so common byte pairs get single codes from the start
- **LZX** (`lzx.js`) - Microsoft's Lempel-Ziv Extended codec used in CAB, CHM and WIM
- **MCM** (`mcm.js`) - Two-level context-mixing network: local (orders 0-2), medium (orders 3-4) and wide (order 6 + sparse skip-1) model groups, each mixed by their own mixer, combined by a top-level mixer and refined by two chained SSE stages
- **Move-to-Front (MTF)** (`mtf.js`) - Data transformation algorithm that restructures data for better compressibility by moving recently seen symbols to the front of the alphabet
- **MS-LZH** (`ms-lzh.js`) - Microsoft DriveSpace 3 codec: LZ77 over a 4 KiB window feeding a DEFLATE-shaped alphabet of 286 literal/length symbols and 30 distance symbols
- **Neural Network Compression (Educational)** (`neural-compression.js`) - Online-trained two-layer neural predictor (backprop through a tanh hidden layer) driving a binary arithmetic coder, NNCP-style
- **NRV2D** (`nrv2d.js`) - UCL library "Not Really Vanished" LZ77 variant 2D
- **NRV2E** (`nrv2e.js`) - UCL library "Not Really Vanished" LZ77 variant 2E
- **Omega Coding** (`omega.js`) - Universal code for positive integers with self-delimiting property
- **PackBits RLE** (`packbits.js`) - Classic run-length encoding algorithm used in TIFF images, PostScript, and early Apple computer systems
- **PAQ (Context Mixing)** (`paq.js`) - Reduced lpaq-style context-mixing primitive: six hashed bit models over byte orders 0, 1, 2, 3, 4 and 6, blended by a single logistic-domain mixer trained by online gradient descent, refined by one adaptive probability map (SSE) keyed on the previous byte, and entropy-coded with a 30-bit binary arithmetic coder
- **PAQ8hp (High Performance)** (`paq8hp.js`) - Reduced context-mixing model set (hashed orders 0,1,2,3,4,6 plus a match model, combined with PAQ8-style context-selected mixing - 16 weight vectors chosen by the previous byte's high nibble - and refined by a single SSE stage)
- **Pithy** (`pithy.js`) - Fast LZ77-based compression library by John Engelhart, inspired by Google's Snappy but with incompatible format
- **PPM (Prediction by Partial Matching)** (`ppm.js`) - Order-3 finite-context model with escape method C and full exclusion, driving a Witten-Neal-Cleary arithmetic coder
- **PPMd (PPM with Dynamic Memory)** (`ppmd.js`) - Context trie with Method D escape estimation (escape frequency = number of distinct symbols observed), periodic rescaling, exclusion of already-coded symbols on escape, and a flat order(-1) fallback, entropy-coded with a multi-symbol range coder
- **Quantum** (`quantum.js`) - LZ77 dictionary matching combined with an adaptive arithmetic coder; the compression method Microsoft licensed from David Stafford's Quantum archiver for use inside Cabinet (.CAB) files alongside DEFLATE and LZX
- **QuickLZ** (`quicklz.js`) - Fast compression algorithm optimized for speed (150-300 MB/s)
- **Range Coding** (`range-coding.js`) - Entropy coding method that assigns codewords to symbols based on their probability distributions
- **rANS (Range Asymmetric Numeral Systems)** (`rans.js`) - Advanced entropy coding using range-based asymmetric numeral systems for optimal compression efficiency
- **RAR3 (classic)** (`rar.js`) - The classic RAR method of RAR 3.x and 4.x: LZ77 matching over a 4 MiB dictionary with four repeat-offset slots, coded through four Huffman tables - a 299-symbol main table of literals, repeat markers and match-length slots, a 60-slot distance table, a 17-symbol low-distance table carrying the bottom four bits of long distances, and a 28-symbol repeat-length table
- **RAR5** (`rar5.js`) - Block compression stage of the RAR 5.0 archive format: LZ77 over a 128KB dictionary whose literals, match-length slots, distance slots and low-distance nibbles are entropy coded with four Huffman tables, themselves serialised through a 20-symbol pre-code with run-length escapes
- **Reduce** (`reduce.js`) - PKZIP methods 2-5 (Reducing): a DLE-escaped LZ77 pre-pass (factor-controlled length/distance bit split) followed by a static, frequency-ranked probabilistic substitution stage using per-byte follower sets of up to 32 candidate successor bytes
- **RePair** (`repair.js`) - Recursive pairing grammar compression
- **RLE** (`rle.js`) - Simple compression algorithm that replaces consecutive identical bytes with a count-value pair
- **ROLZ (Reduced Offset LZ)** (`rolz.js`) - Context-aware dictionary compression using reduced offset sets
- **RZIP** (`rzip.js`) - Long-range redundancy-elimination compressor that indexes the entire input with a rolling hash so LZ77-style (offset,length) matches can be found at arbitrary distances, far beyond a classic 32K/64K sliding window
- **Salvador** (`salvador.js`) - Emmanuel Marty's high-speed optimal parser for the ZX0 compressed format
- **Sequitur** (`sequitur.js`) - Online grammar inference by Nevill-Manning and Witten: as each symbol is appended the algorithm enforces digram uniqueness (no adjacent pair occurs twice anywhere in the grammar) and rule utility (every non-start rule is referenced more than once), producing a straight-line grammar in linear time
- **Shannon-Fano Coding** (`shannon-fano.js`) - Variable-length prefix-free coding algorithm that predates Huffman coding
- **Shoco** (`shoco.js`) - Short string compression optimized for English text using a trained character alphabet and successor-rank prediction, packed via Shoco's real multi-tier bit layout (1-/2-/4-byte packs with a unary tier header)
- **Shrink** (`shrink.js`) - PKZIP method 1 (Shrinking): dynamic LZW coding with encoder-controlled variable code width (9-13 bits) and partial dictionary clearing, which frees only leaf (unreferenced) entries instead of resetting the whole table
- **Simplified Deflate (Fixed Huffman)** (`deflate-simple.js`) - Raw RFC 1951 DEFLATE restricted to fixed-Huffman blocks
- **Snappy** (`snappy.js`) - Fast LZ77-based compression algorithm developed by Google in 2011
- **SQX** (`sqx.js`) - The SQX archiver's LZH method: an LZ77 matcher over a 32 KiB dictionary feeding a 310-symbol main tree that folds literals, four repeated-distance slots, length-2 and length-3 matches with inline distances, and 25 length-4-or-more slots into one alphabet, alongside a 48-slot distance tree
- **Suffix Tree Compression** (`suffix-tree.js`) - Advanced lossless compression using suffix tree construction and longest common substring analysis
- **tANS (Table-based Asymmetric Numeral Systems)** (`tans.js`) - Table-driven ANS entropy coder over a 2048-state table
- **Tunstall Coding** (`tunstall.js`) - Variable-to-fixed length source code
- **uABS (Binary Asymmetric Numeral Systems)** (`ans.js`) - Binary variant of Asymmetric Numeral Systems
- **UCL (NRV2B)** (`ucl.js`) - Universal Compression Library implementing NRV2B algorithm
- **Unary Coding** (`unary.js`) - Universal integer coding where number n is represented by n-1 ones followed by a zero
- **Xpress** (`xpress.js`) - Microsoft's LZ77+Huffman compression algorithm ([MS-XCA]), used in WIM images, NTFS, and Hyper-V
- **XZ/LZMA2** (`xz-lzma2.js`) - Genuine .xz container (stream header/block/index/footer, CRC32/CRC64) wrapping a real LZMA1 range encoder/decoder pair through real LZMA2 chunk framing
- **Zling** (`zling.js`) - LZ77 dictionary matching followed by canonical Huffman entropy coding, after Zhang Li's libzling
- **Zopfli** (`zopfli.js`) - Iterative-optimal DEFLATE encoder from Google (2013)
- **ZPAQ (Context Mixing)** (`zpaq.js`) - The context-mixing compressor at the heart of ZPAQ: four direct context models over hashed orders 1 to 4 predict each bit of the message, their predictions are averaged, and a carry-propagating binary range coder turns confident predictions into fractions of a bit
- **Zstandard** (`zstd.js`) - Zstandard (Zstd), RFC 8878
- **ZX0** (`zx0.js`) - LZ77 compressor for 8-bit targets designed by Einar Saukas

<!-- END GENERATED ALGORITHM LIST -->

## Not Yet Implemented

Kept by hand, because deciding what is worth adding is a judgement the registry
cannot make. `tools/refresh-readmes.js` checks this list against the registry and
fails if anything here has since been implemented.

- [ ] **Grammar-based codes** - grammar compression methods beyond Sequitur, Re-Pair and BPE
- [ ] **K-means Clustering** - for lossy data compression applications
- [ ] **Psychoacoustic Compression** - audio compression using hearing models

## Algorithm Categories

### By Method
- **Dictionary-based**: LZ77, LZ78, LZW, LZ4, LZSS, LZO, LZMA
- **Statistical**: Huffman, Shannon-Fano, Arithmetic Coding, PPM
- **Transform-based**: BWT, DCT, Wavelet, FFT-based
- **Universal codes**: Elias Delta/Gamma, Fibonacci, Golomb, Unary
- **Grammar-based**: Sequitur, Re-Pair, BPE
- **Predictive**: Delta, DPCM, LPC, PPM

### By Performance
- **High Speed**: LZ4, Snappy, LZO
- **High Compression**: LZMA, Brotli, PAQ, Zstandard
- **Balanced**: DEFLATE, LZ77/78, Zlib

### By Application
- **Web**: Brotli, DEFLATE, Zstandard
- **Archive**: LZ4, LZMA, Zstandard, PAQ
- **Real-time**: LZ4, Snappy, LZO
- **Embedded**: LZ77, RLE, Simple Huffman

## Implementation Notes

All compression algorithms in this collection:
- Follow the universal cipher pattern established in the codebase
- Support both Node.js and browser environments
- Include comprehensive test vectors where available
- Implement proper error handling and edge case management
- Are designed for educational and research purposes

## References

- [English Wikipedia - Data Compression](https://en.wikipedia.org/wiki/Data_compression)
- [German Wikipedia - Datenkompression](https://de.wikipedia.org/wiki/Datenkompression)
- [Chinese Wikipedia - 数据压缩](https://zh.wikipedia.org/wiki/%E6%95%B0%E6%8D%AE%E5%8E%8B%E7%BC%A9)
- [Russian Wikipedia - Сжатие данных](https://ru.wikipedia.org/wiki/%D0%A1%D0%B6%D0%B0%D1%82%D0%B8%D0%B5_%D0%B4%D0%B0%D0%BD%D0%BD%D1%8B%D1%85)
- [Japanese Wikipedia - データ圧縮](https://ja.wikipedia.org/wiki/%E3%83%87%E3%83%BC%E3%82%BF%E5%9C%A7%E7%B8%AE)
- [Arabic Wikipedia - ضغط البيانات](https://ar.wikipedia.org/wiki/%D8%B6%D8%BA%D8%B7_%D8%A7%D9%84%D8%A8%D9%8A%D8%A7%D9%86%D8%A7%D8%AA)
