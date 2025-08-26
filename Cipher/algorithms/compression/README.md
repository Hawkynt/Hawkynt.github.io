# Compression Algorithms

This directory contains implementations of various data compression algorithms. The following comprehensive list includes algorithms researched from multiple Wikipedia sources (English, German, Chinese, Russian, Japanese, Arabic).

## Implemented Algorithms ✅

### Lossless Compression
- [x] **Arithmetic Coding** (`arithmetic.js`) - Statistical compression method
- [x] **Byte Pair Encoding (BPE)** (`bpe.js`) - Simple compression based on byte pair replacement
- [x] **Brotli** (`brotli.js`) - Modern web compression algorithm by Google
- [x] **Burrows-Wheeler Transform** (`bwt.js`) - Data transformation for compression
- [x] **DEFLATE (Simple)** (`deflate-simple.js`) - Combination of LZ77 and Huffman coding
- [x] **Delta Encoding** (`delta.js`) - Stores differences between consecutive values
- [x] **Elias Delta Coding** (`elias-delta.js`) - Universal code for positive integers
- [x] **Elias Gamma Coding** (`elias-gamma.js`) - Universal code for positive integers
- [x] **Fibonacci Coding** (`fibonacci.js`) - Universal code based on Fibonacci sequence
- [x] **Huffman Coding** (`huffman.js`) - Optimal prefix-free coding
- [x] **LZ4** (`lz4.js`) - Fast lossless compression algorithm
- [x] **LZ77** (`lz77.js`) - Dictionary-based compression algorithm
- [x] **LZ78** (`lz78.js`) - Dictionary-based compression algorithm
- [x] **Lempel-Ziv-Welch (LZW)** (`lzw.js`) - Adaptive dictionary compression
- [x] **Prediction by Partial Matching (PPM)** (`ppm.js`) - Context modeling compression
- [x] **Run-Length Encoding (RLE)** (`rle.js`) - Simple compression for repetitive data
- [x] **Shannon-Fano Coding** (`shannon-fano.js`) - Prefix-free coding algorithm
- [x] **Unary Coding** (`unary.js`) - Simple universal code
- [x] **Zstandard** (`zstd.js`) - Modern compression algorithm by Facebook

## Missing Algorithms ❌

### Lossless Compression
- [ ] **LZSS (Lempel-Ziv-Storer-Szymanski)** - Improved version of LZ77
- [ ] **LZO (Lempel-Ziv-Oberhumer)** - Fast compression library
- [ ] **LZMA (Lempel-Ziv-Markow)** - High compression ratio algorithm
- [ ] **LZX** - Microsoft compression algorithm
- [ ] **LZJB** - Compression algorithm used in ZFS
- [ ] **LZFSE** - Apple's compression algorithm
- [ ] **LZRW** - Lempel-Ziv Ross Williams variants
- [ ] **LZS** - Lempel-Ziv-Stac compression
- [ ] **LZT** - Lempel-Ziv-Tischer compression
- [ ] **Snappy** - Fast compression library by Google
- [ ] **Zopfli** - Compression algorithm by Google
- [ ] **ROLZ (Reduced Offset Lempel Ziv)** - Variant of LZ compression
- [ ] **Move to Front** - Data transformation technique
- [ ] **PAQ** - Series of archiving programs
- [ ] **Sequitur** - Grammar-based compression algorithm
- [ ] **Re-Pair** - Grammar-based compression
- [ ] **Grammar-based codes** - Various grammar compression methods
- [ ] **Golomb Codes** - Exponential-Golomb coding
- [ ] **Universal Codes** - Elias Codes, Fibonacci Codes variants
- [ ] **Context Tree Weighting** - Lossless data compression algorithm

### Specialized Compression
- [ ] **K-means Clustering** - For data compression applications
- [ ] **Large Language Model Compression** - Experimental AI model compression
- [ ] **Psychoacoustic Compression** - Audio compression using hearing models

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
