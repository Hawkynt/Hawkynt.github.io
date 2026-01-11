# BitBench - Binary/Bitwise Workbench

![License](https://img.shields.io/github/license/Hawkynt/Hawkynt.github.io)
![Language](https://img.shields.io/github/languages/top/Hawkynt/Hawkynt.github.io?color=purple)
[![Last Commit](https://img.shields.io/github/last-commit/Hawkynt/Hawkynt.github.io?branch=main)![Activity](https://img.shields.io/github/commit-activity/y/Hawkynt/Hawkynt.github.io?branch=main)](https://github.com/Hawkynt/Hawkynt.github.io/commits/main)
[![GitHub release](https://img.shields.io/github/v/release/Hawkynt/Hawkynt.github.io)](https://github.com/Hawkynt/Hawkynt.github.io/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/Hawkynt/Hawkynt.github.io/total)](https://github.com/Hawkynt/Hawkynt.github.io/releases)

> An interactive workbench for binary/hex/decimal conversions, bitfield editing, bit manipulation operations, and code generation with comprehensive format support.

## What It Does

BitBench is a comprehensive tool for working with binary data at the bit level. It provides:

- **Multi-Format Type Interpretations**: View bit patterns as integers, floats, fixed-point, BCD, timestamps, colors, and more
- **Endianness Support**: Both Little Endian (LE) and Big Endian (BE) for all multi-byte types
- **Type Aliases**: Industry-standard naming (UInt32, uint, dword, DWORD all show the same interpretation)
- **Bitfield Editor**: Visual bit toggling with named field definitions
- **Bit Operations**: Shift, rotate, NOT, endianness swap
- **Statistics**: Popcount, parity, CLZ, CTZ
- **Code Export**: Generate C/C++/C# code for masks and accessor macros

---

## Complete Type Reference

### Integer Types

| Type     | Bits | Signed | Range             | Format         | C/C++                            | C#       | Java    | Rust  | Go              | Pascal     | Description                           |
| -------- | ---- | ------ | ----------------- | -------------- | -------------------------------- | -------- | ------- | ----- | --------------- | ---------- | ------------------------------------- |
| Tiny     | 8    | Yes    | -128 to 127       | 2's complement | `int8_t`, `signed char`          | `sbyte`  | `byte`  | `i8`  | `int8`          | `ShortInt` | Signed 8-bit integer                  |
| Byte     | 8    | No     | 0 to 255          | Unsigned       | `uint8_t`, `unsigned char`       | `byte`   | -       | `u8`  | `uint8`, `byte` | `Byte`     | Unsigned 8-bit integer                |
| Short    | 16   | Yes    | -32,768 to 32,767 | 2's complement | `int16_t`, `short`               | `short`  | `short` | `i16` | `int16`         | `SmallInt` | Signed 16-bit integer                 |
| Word     | 16   | No     | 0 to 65,535       | Unsigned       | `uint16_t`, `unsigned short`     | `ushort` | `char`  | `u16` | `uint16`        | `Word`     | Unsigned 16-bit integer               |
| Int      | 32   | Yes    | -2.1B to 2.1B     | 2's complement | `int32_t`, `int`                 | `int`    | `int`   | `i32` | `int32`         | `Integer`  | Signed 32-bit integer                 |
| DWord    | 32   | No     | 0 to 4.3B         | Unsigned       | `uint32_t`, `unsigned int`       | `uint`   | -       | `u32` | `uint32`        | `Cardinal` | Unsigned 32-bit integer (Double Word) |
| Long     | 64   | Yes    | -9.2E18 to 9.2E18 | 2's complement | `int64_t`, `long long`           | `long`   | `long`  | `i64` | `int64`         | `Int64`    | Signed 64-bit integer                 |
| QWord    | 64   | No     | 0 to 1.8E19       | Unsigned       | `uint64_t`, `unsigned long long` | `ulong`  | -       | `u64` | `uint64`        | `QWord`    | Unsigned 64-bit integer (Quad Word)   |
| Gray8    | 8    | No     | 0 to 255          | Gray code      | -                                | -        | -       | -     | -               | -          | 8-bit reflected binary code           |
| Gray16   | 16   | No     | 0 to 65,535       | Gray code      | -                                | -        | -       | -     | -               | -          | 16-bit reflected binary code          |
| Gray32   | 32   | No     | 0 to 4.3B         | Gray code      | -                                | -        | -       | -     | -               | -          | 32-bit reflected binary code          |
| Gray64   | 64   | No     | 0 to 1.8E19       | Gray code      | -                                | -        | -       | -     | -               | -          | 64-bit reflected binary code          |
| Zigzag8  | 8    | Yes    | -128 to 127       | Zigzag         | -                                | -        | -       | -     | -               | -          | 8-bit zigzag encoded signed           |
| Zigzag16 | 16   | Yes    | -32,768 to 32,767 | Zigzag         | -                                | -        | -       | -     | -               | -          | 16-bit zigzag encoded signed          |
| Zigzag32 | 32   | Yes    | -2.1B to 2.1B     | Zigzag         | `sint32` (protobuf)              | -        | -       | -     | -               | -          | 32-bit zigzag encoded signed          |
| Zigzag64 | 64   | Yes    | -9.2E18 to 9.2E18 | Zigzag         | `sint64` (protobuf)              | -        | -       | -     | -               | -          | 64-bit zigzag encoded signed          |

### IEEE 754 Floating Point

| Type       | Bits | Range    | Format (s/e/m) | Bias | C/C++                | C#       | Java     | Rust  | Go        | Pascal   | Description               |
| ---------- | ---- | -------- | -------------- | ---- | -------------------- | -------- | -------- | ----- | --------- | -------- | ------------------------- |
| Minifloat8 | 8    | ±1.9E2   | 1/4/3          | 7    | -                    | -        | -        | -     | -         | -        | 8-bit IEEE 754-style      |
| Float16    | 16   | ±6.55E4  | 1/5/10         | 15   | `_Float16`, `__fp16` | `Half`   | -        | -     | -         | -        | IEEE 754 half precision   |
| Float32    | 32   | ±3.4E38  | 1/8/23         | 127  | `float`              | `float`  | `float`  | `f32` | `float32` | `Single` | IEEE 754 single precision |
| Float64    | 64   | ±1.8E308 | 1/11/52        | 1023 | `double`             | `double` | `double` | `f64` | `float64` | `Double` | IEEE 754 double precision |

### AI/ML Floating Point

| Type     | Bits | Range   | Format (s/e/m) | Bias | Origin     | Aliases          | Description                    |
| -------- | ---- | ------- | -------------- | ---- | ---------- | ---------------- | ------------------------------ |
| BFloat8  | 8    | ±1.9E2  | 1/4/3          | 7    | Custom     | `bf8`            | 8-bit truncated brain float    |
| BFloat16 | 16   | ±3.4E38 | 1/8/7          | 127  | Google     | `bf16`           | Google Brain truncated float32 |
| BFloat32 | 32   | ±3.4E38 | 1/8/23         | 127  | Custom     | `bf32`           | Brain float family (= Float32) |
| BFloat64 | 64   | ±3.4E38 | 1/8/55         | 127  | Custom     | `bf64`           | Extended brain float           |
| FP8-E4M3 | 8    | ±448    | 1/4/3          | 7    | NVIDIA/ARM | `E4M3`           | ML inference format (no inf)   |
| FP8-E5M2 | 8    | ±5.7E4  | 1/5/2          | 15   | NVIDIA/ARM | `E5M2`           | ML training format             |
| TF32     | 32   | ±3.4E38 | 1/8/10         | 127  | NVIDIA     | `TensorFloat-32` | Tensor core format (19-bit)    |

### Exotic Floating Point

| Type    | Bits | Range    | Format (s/e/m) | Bias | Origin    | Aliases        | Description                |
| ------- | ---- | -------- | -------------- | ---- | --------- | -------------- | -------------------------- |
| IBM HFP | 32   | ±7.2E75  | 1/7/24         | 64   | IBM       | `hex float`    | Hexadecimal floating point |
| VAX F   | 32   | ±1.7E38  | 1/8/23         | 128  | DEC       | `F_floating`   | VAX F_floating format      |
| MBF32   | 32   | ±1.7E38  | 8e/1s/23m      | 128  | Microsoft | `MS Binary`    | Microsoft Binary Format    |
| MBF64   | 64   | ±1.7E308 | 8e/1s/55m      | 128  | Microsoft | `MS Binary 64` | Microsoft Binary Format 64 |
| Posit8  | 8    | ±64      | Variable       | -    | Gustafson | `posit<8,0>`   | Unum Type III (es=0)       |
| Posit16 | 16   | ±1.7E8   | Variable       | -    | Gustafson | `posit<16,1>`  | Unum Type III (es=1)       |
| Posit32 | 32   | ±1.3E17  | Variable       | -    | Gustafson | `posit<32,2>`  | Unum Type III (es=2)       |

### Decimal Floating Point

| Type      | Bits | Digits | Exponent Range    | Encoding   | Standard      | Description          |
| --------- | ---- | ------ | ----------------- | ---------- | ------------- | -------------------- |
| Decimal8  | 8    | 1      | 10^-4 to 10^2     | Custom BID | Custom        | 8-bit decimal float  |
| Decimal16 | 16   | 3      | 10^-16 to 10^14   | Custom BID | Custom        | 16-bit decimal float |
| Decimal32 | 32   | 7      | 10^-101 to 10^90  | BID        | IEEE 754-2008 | 32-bit decimal float |
| Decimal64 | 64   | 16     | 10^-398 to 10^369 | BID        | IEEE 754-2008 | 64-bit decimal float |

### Fixed Point (Q Format)

| Type    | Bits | Signed | Integer Bits | Fraction Bits | Range                          | Description                |
| ------- | ---- | ------ | ------------ | ------------- | ------------------------------ | -------------------------- |
| Q7.8    | 16   | Yes    | 8            | 8             | -128.0 to 127.996              | Signed 8.8 fixed point     |
| Q15.16  | 32   | Yes    | 16           | 16            | -32768.0 to 32767.999985       | Signed 16.16 fixed point   |
| Q31.32  | 64   | Yes    | 32           | 32            | -2.1B to 2.1B (with fractions) | Signed 32.32 fixed point   |
| UQ8.8   | 16   | No     | 8            | 8             | 0 to 255.996                   | Unsigned 8.8 fixed point   |
| UQ16.16 | 32   | No     | 16           | 16            | 0 to 65535.999985              | Unsigned 16.16 fixed point |
| UQ32.32 | 64   | No     | 32           | 32            | 0 to 4.3B (with fractions)     | Unsigned 32.32 fixed point |

### Binary Coded Decimals (BCD)

#### Packed BCD (2 digits per byte)

| Type  | Bits | Digits | Range             | Description               |
| ----- | ---- | ------ | ----------------- | ------------------------- |
| BCD8  | 8    | 2      | 00-99             | 2 decimal digits per byte |
| BCD16 | 16   | 4      | 0000-9999         | 4 decimal digits          |
| BCD32 | 32   | 8      | 00000000-99999999 | 8 decimal digits          |
| BCD64 | 64   | 16     | 16 decimal digits | 16 decimal digits         |

#### Unpacked BCD (1 digit per byte)

| Type         | Bits | Aliases             | Range | Description                                   |
| ------------ | ---- | ------------------- | ----- | --------------------------------------------- |
| Unpacked BCD | 8    | UBCD, zoned decimal | 0-9   | 1 digit per byte (lower nibble, zone ignored) |

Use array syntax (e.g., `Unpacked BCD[4]`) for multi-digit values.

### Character Encodings

| Type    | Bits | Range           | Encoding | C/C++                 | C#     | Java   | Description                      |
| ------- | ---- | --------------- | -------- | --------------------- | ------ | ------ | -------------------------------- |
| ASCII   | 8    | 0-127           | ASCII    | `char`                | -      | -      | 7-bit ASCII character            |
| ASCII16 | 16   | 2 chars         | ASCII    | -                     | -      | -      | Two ASCII characters             |
| ASCII32 | 32   | 4 chars         | ASCII    | -                     | -      | -      | Four ASCII characters            |
| ASCII64 | 64   | 8 chars         | ASCII    | -                     | -      | -      | Eight ASCII characters           |
| EBCDIC  | 8    | 0-255           | EBCDIC   | -                     | -      | -      | IBM mainframe encoding           |
| UTF-8   | 8    | 0-255           | UTF-8    | `char8_t`             | -      | -      | UTF-8 code unit (variable len)   |
| UTF-16  | 16   | U+0000-U+FFFF   | UTF-16   | `wchar_t`, `char16_t` | `char` | `char` | UTF-16 code unit (BMP/surrogate) |
| UTF-32  | 32   | U+0000-U+10FFFF | UTF-32   | `char32_t`            | -      | -      | Full Unicode code point          |

### Color Formats

| Type     | Bits | Components | Order                            | C/C++      | Description                  |
| -------- | ---- | ---------- | -------------------------------- | ---------- | ---------------------------- |
| RGB      | 32   | 8/8/8      | 0x00RRGGBB                       | -          | Standard RGB (8 bits unused) |
| RGBA     | 32   | 8/8/8/8    | 0xAARRGGBB                       | -          | RGB with alpha channel       |
| BGR24    | 32   | 8/8/8      | 0x00BBGGRR                       | `COLORREF` | Windows GDI color            |
| BGRA32   | 32   | 8/8/8/8    | 0xAABBGGRR                       | -          | Windows DIB with alpha       |
| ABGR32   | 32   | 8/8/8/8    | 0xRRGGBBAA                       | -          | Alpha-Blue-Green-Red         |
| RGB565   | 16   | 5/6/5      | RRRRRGGGGGGBBBBB                 | -          | 16-bit color (65K colors)    |
| RGB555   | 16   | 5/5/5      | 0RRRRRGGGGGBBBBB                 | -          | 15-bit color (32K colors)    |
| ARGB1555 | 16   | 1/5/5/5    | ARRRRRGGGGGBBBBB                 | -          | 15-bit color + 1-bit alpha   |
| ARGB4444 | 16   | 4/4/4/4    | AAARRRRGGGGBBBB                  | -          | 12-bit color + 4-bit alpha   |
| HSV      | 32   | H/S/V      | Hue(0-359)/Sat(0-100)/Val(0-100) | -          | Hue-Saturation-Value         |

### Date/Time Formats

| Type         | Bits | Epoch      | Resolution | Range                     | Platform | Description                           |
| ------------ | ---- | ---------- | ---------- | ------------------------- | -------- | ------------------------------------- |
| Unix32       | 32   | 1970-01-01 | 1 second   | 1901-12-13 to 2038-01-19  | POSIX    | Standard Unix timestamp (Y2038 issue) |
| Unix64       | 64   | 1970-01-01 | 1 second   | ±292 billion years        | POSIX    | Extended Unix timestamp               |
| DOS DateTime | 32   | 1980-01-01 | 2 seconds  | 1980-01-01 to 2107-12-31  | DOS/FAT  | FAT filesystem timestamp              |
| FILETIME     | 64   | 1601-01-01 | 100 ns     | 1601-01-01 to 30828-09-14 | Windows  | Windows file timestamp                |
| OLE Date     | 64   | 1899-12-30 | ~1 ms      | 0100-01-01 to 9999-12-31  | COM/OLE  | As double (days.fraction)             |
| NTP          | 64   | 1900-01-01 | ~232 ps    | 1900-01-01 to 2036-02-07  | Network  | Q32.32 fixed-point seconds (era 0)    |
| HFS+         | 32   | 1904-01-01 | 1 second   | 1904-01-01 to 2040-02-06  | macOS    | HFS+ filesystem timestamp             |
| GPS Time     | 32   | 1980-01-06 | 1 second   | 1980-01-06 to 2137~       | GPS      | GPS week/seconds                      |
| WebKit       | 64   | 1601-01-01 | 1 us       | 1601-01-01 to ~294247 AD  | Chrome   | Chrome/WebKit timestamp               |
| .NET Ticks   | 64   | 0001-01-01 | 100 ns     | 0001-01-01 to 9999-12-31  | .NET     | DateTime.Ticks value                  |

### Audio Formats

| Type      | Bits | Range         | Standard    | Description                            |
| --------- | ---- | ------------- | ----------- | -------------------------------------- |
| mu-law    | 8    | -8159 to 8159 | ITU-T G.711 | Companded audio (North America/Japan)  |
| A-law     | 8    | -4032 to 4032 | ITU-T G.711 | Companded audio (Europe/International) |
| MIDI Note | 8    | 0-127         | MIDI 1.0    | Note number (C-1=0, A4=69)             |

### Network & Special Formats

| Type     | Bits | Format            | Standard | Description                           |
| -------- | ---- | ----------------- | -------- | ------------------------------------- |
| IPv4     | 32   | a.b.c.d           | RFC 791  | Internet Protocol v4 address          |
| IPv6-L   | 64   | lower 64 bits     | RFC 4291 | IPv6 interface identifier portion     |
| MAC-48   | 48   | aa:bb:cc:dd:ee:ff | IEEE 802 | Ethernet MAC address                  |
| Port     | 16   | 0-65535           | TCP/UDP  | Network port number                   |
| FourCC   | 32   | 4 ASCII chars     | Various  | Four-Character Code (codecs, formats) |
| Currency | 64   | scaled /10000     | OLE      | OLE Currency (CY) type                |

---

## Format Origins & References

### Two's Complement Integers

Two's complement is the most common method for representing signed integers in binary. Invented to simplify binary arithmetic circuits, it allows addition and subtraction using the same hardware. The format naturally handles overflow and underflow in a predictable way.

- [Two's complement - Wikipedia](https://en.wikipedia.org/wiki/Two%27s_complement)

### Gray Code

Gray code (reflected binary code) was invented by Frank Gray at Bell Labs in 1947 for preventing spurious output from electromechanical switches. In Gray code, two successive values differ in only one bit, eliminating transition errors. It's widely used in rotary encoders, analog-to-digital converters, and error correction.

- Patent: US Patent 2,632,058 (1953)
- [Gray code - Wikipedia](https://en.wikipedia.org/wiki/Gray_code)

### Zigzag Encoding

Zigzag encoding maps signed integers to unsigned integers so that numbers with small absolute values have small encoded values. It encodes negative numbers as positive numbers by interleaving: 0 -> 0, -1 -> 1, 1 -> 2, -2 -> 3, etc. Developed by Google for Protocol Buffers to enable efficient variable-length encoding of signed integers.

- [Protocol Buffers Encoding](https://developers.google.com/protocol-buffers/docs/encoding#signed-ints)

### IEEE 754 Binary Floating Point

IEEE 754 is the technical standard for floating-point arithmetic established in 1985 and revised in 2008 and 2019. It defines formats (binary16, binary32, binary64, binary128), rounding modes, and operations. The format uses a sign bit, biased exponent, and normalized mantissa with an implicit leading 1.

- IEEE 754-2019: IEEE Standard for Floating-Point Arithmetic
- [IEEE 754 - Wikipedia](https://en.wikipedia.org/wiki/IEEE_754)
- [What Every Computer Scientist Should Know About Floating-Point Arithmetic](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html)

### BFloat16 (Brain Floating Point)

BFloat16 was developed by Google Brain for machine learning applications. It uses the same exponent range as float32 (8-bit exponent) but with reduced precision (7-bit mantissa instead of 23). This makes conversion to/from float32 trivial (just truncate/pad the mantissa) while maintaining dynamic range suitable for neural network training.

- [BFloat16 - Wikipedia](https://en.wikipedia.org/wiki/Bfloat16_floating-point_format)
- [Google Cloud TPU BFloat16](https://cloud.google.com/tpu/docs/bfloat16)

### FP8 (8-bit Floating Point)

FP8 formats were standardized jointly by NVIDIA, ARM, and Intel for machine learning inference (E4M3: 1-4-3) and training (E5M2: 1-5-2). E4M3 has more precision for inference weights, while E5M2 has greater range for training gradients.

- [FP8 Formats for Deep Learning](https://arxiv.org/abs/2209.05433)
- [NVIDIA FP8 Training](https://developer.nvidia.com/blog/nvidia-ampere-architecture-fp8-training/)

### TensorFloat-32 (TF32)

TF32 is a 19-bit format (stored in 32 bits) introduced with NVIDIA Ampere GPUs. It combines float32's 8-bit exponent with a 10-bit mantissa, offering a balance between speed and precision for tensor core operations in deep learning.

- [NVIDIA TensorFloat-32](https://blogs.nvidia.com/blog/2020/05/14/tensorfloat-32-precision-format/)

### Posit (Unum Type III)

Posits were proposed by John Gustafson as a replacement for IEEE 754 floats. They use a variable-length "regime" field that provides tapered precision - very high precision near 1.0 and gracefully decreasing precision toward extremes. This eliminates NaN/Infinity overhead and provides better accuracy per bit.

- Gustafson, J.L. "Posit Arithmetic" (2017)
- [Posit - Wikipedia](https://en.wikipedia.org/wiki/Unum_(number_format)#Posit)
- [Posit Standard](https://posithub.org/docs/posit_standard.pdf)

### IBM Hexadecimal Floating Point

IBM HFP was used on IBM System/360 and successors since 1964. It uses a base-16 (hexadecimal) exponent rather than base-2, providing a different precision/range tradeoff. The mantissa is not normalized to have a leading 1, so the format can have up to 3 leading zero bits.

- [IBM hexadecimal floating-point - Wikipedia](https://en.wikipedia.org/wiki/IBM_hexadecimal_floating-point)

### VAX Floating Point

VAX F_floating was used on DEC VAX computers (1977-1990s). It has similar precision to IEEE binary32 but with different encoding, byte order, and handling of special values (no infinities or NaN, reserved operand instead).

- [VAX Floating Point - Wikipedia](https://en.wikipedia.org/wiki/VAX_floating_point)

### Microsoft Binary Format (MBF)

MBF was used in Microsoft BASIC interpreters and early MS-DOS software (1975-1991). It predates IEEE 754 and stores the exponent in the most significant byte. The format was superseded by IEEE 754 starting with QuickBASIC 4.0.

- [Microsoft Binary Format - Wikipedia](https://en.wikipedia.org/wiki/Microsoft_Binary_Format)

### IEEE 754 Decimal Floating Point

IEEE 754-2008 added decimal floating-point formats (decimal32, decimal64, decimal128) for financial and scientific applications requiring exact decimal arithmetic. BitBench uses BID (Binary Integer Decimal) encoding where the significand is stored as a binary integer.

- IEEE 754-2008 Standard
- [Decimal floating point - Wikipedia](https://en.wikipedia.org/wiki/Decimal_floating_point)

### Fixed-Point (Q Format)

Q format notation (Q m.n) specifies fixed-point numbers with m integer bits and n fractional bits. Widely used in DSP, embedded systems, and game development where floating-point hardware is unavailable or too slow. The ARM and TI DSP processors use this extensively.

- [Q (number format) - Wikipedia](https://en.wikipedia.org/wiki/Q_(number_format))

### Binary Coded Decimal (BCD)

BCD represents decimal digits as 4-bit binary groups. Packed BCD stores two digits per byte. Used in financial applications (exact decimal representation), older hardware (4004/8080 had BCD instructions), and displays (7-segment LEDs). The x86 AAA/AAS/DAA/DAS instructions support BCD arithmetic.

- [Binary-coded decimal - Wikipedia](https://en.wikipedia.org/wiki/Binary-coded_decimal)

### Color Formats

- **RGB/RGBA**: Standard color model based on additive primary colors
- **BGR**: Used by Windows GDI for historical reasons (memory layout optimization)
- **RGB565/555**: Optimized 16-bit color for low-memory graphics (early GPUs, embedded systems)
- **HSV**: Hue-Saturation-Value, more intuitive for color selection

References:

- [RGB color model - Wikipedia](https://en.wikipedia.org/wiki/RGB_color_model)
- [COLORREF - Windows](https://docs.microsoft.com/en-us/windows/win32/gdi/colorref)

### Timestamp Formats

| Format           | Rationale                                               |
| ---------------- | ------------------------------------------------------- |
| **Unix**         | Simple seconds count; ubiquitous in POSIX systems       |
| **FILETIME**     | 100ns precision; covers 1601-30828 AD                   |
| **NTP**          | Fixed-point for precise network synchronization         |
| **DOS DateTime** | Space-efficient for FAT filesystem; 2-second resolution |
| **HFS+**         | Apple's Unix-like timestamp with 1904 epoch             |
| **OLE Date**     | Double precision for COM automation; Excel dates        |
| **.NET Ticks**   | Maximum precision (100ns) since year 1                  |

- [Unix time - Wikipedia](https://en.wikipedia.org/wiki/Unix_time)
- [FILETIME structure - Microsoft](https://docs.microsoft.com/en-us/windows/win32/api/minwinbase/ns-minwinbase-filetime)

### Audio Codecs (G.711)

ITU-T G.711 defines companding algorithms for voice-frequency audio encoding:

- **mu-law (μ-law)**: Used in North America and Japan telephone networks
- **A-law**: Used in Europe and international telephone networks

Both compress 14-bit linear PCM to 8-bit companded representation, providing ~13-bit dynamic range.

- ITU-T G.711: Pulse Code Modulation (PCM)
- [G.711 - Wikipedia](https://en.wikipedia.org/wiki/G.711)

### MIDI

Musical Instrument Digital Interface defines note numbers 0-127, where Middle C (C4) is note 60 and A440 is note 69. Each semitone is one note number.

- [MIDI - Wikipedia](https://en.wikipedia.org/wiki/MIDI)

---

## How It Works

### Input Modes

Enter values in multiple formats:

- **Hex**: `0xDEADBEEF` or `DEADBEEF`
- **Decimal**: `3735928559`
- **Signed**: `-559038737`
- **Float**: Decimal numbers or math expressions (see below)
- **Binary**: `0b1101...`
- **Octal**: `0o33653337357`

### Float Mode - Math Expressions

Float mode supports mathematical expressions in addition to plain decimal numbers. Type formulas like:

- `1/3` → 0.333...
- `sin(pi/4)` → 0.707...
- `2**10` or `2^10` → 1024
- `sqrt(2)` → 1.414...
- `25*cos(1/tan(15))`

#### Supported Functions

| Category            | Functions                                               |
| ------------------- | ------------------------------------------------------- |
| **Trigonometric**   | `sin`, `cos`, `tan`, `cot`, `sec`, `csc`                |
| **Inverse Trig**    | `asin`, `acos`, `atan`, `acot`, `asec`, `acsc`, `atan2` |
| **Hyperbolic**      | `sinh`, `cosh`, `tanh`, `coth`, `sech`, `csch`          |
| **Inv. Hyperbolic** | `asinh`, `acosh`, `atanh`, `acoth`, `asech`, `acsch`    |
| **Area (aliases)**  | `arsinh`, `arcosh`, `artanh`                            |
| **Logarithmic**     | `log` (natural), `ln`, `log10`, `log2`                  |
| **Exponential**     | `exp`, `pow`, `sqrt`, `cbrt`                            |
| **Rounding**        | `abs`, `ceil`, `floor`, `round`, `trunc`, `sign`        |
| **Other**           | `min`, `max`, `hypot`, `frac`, `deg`, `rad`             |

#### Constants

`pi`, `e`, `tau` (2π), `phi` (golden ratio), `inf`, `nan`

#### Operators

`+`, `-`, `*`, `/`, `^` or `**` (power), `()` (parentheses)

#### Autocomplete

When typing function names, an autocomplete dropdown appears:

- **Tab** or **Enter**: Complete the selected function
- **Up/Down arrows**: Navigate suggestions (circular)
- **Escape**: Close dropdown

Each suggestion shows the function name and a brief description.

### Type Interpretations

The left panel shows the current bit pattern interpreted as every applicable format. Categories can be expanded/collapsed:

- **Integers**: Signed and unsigned in LE/BE, Gray code, Zigzag encoding
- **IEEE 754 Floats**: Half, single, double precision
- **Exotic Floats**: BFloat8/16/32/64, IBM, VAX, MBF, FP8 (ML), Posit, TF32
- **Fixed Point**: Q-format fixed point numbers
- **Decimal/BCD**: Binary Coded Decimal, IEEE Decimal floats
- **Colors**: RGB, RGBA, BGR, HSV, and 16-bit color formats
- **Date/Time**: Unix, DOS, FILETIME, NTP, and other timestamps
- **Audio**: mu-law, A-law, MIDI note numbers
- **Special**: Network addresses, FourCC codes, currency
- **Characters**: ASCII, EBCDIC, UTF-32

### Bit Editor

Click any bit to toggle it. Define named fields for structured data:

1. Enter field name
2. Set start bit position
3. Set field width
4. Fields are color-coded on the grid

**Quick Field Loading**: Double-click any format name in the Type Interpretations panel to instantly load its bit field components. For example:

- Double-click "Float32" to see Sign, Exponent, and Mantissa fields
- Double-click "RGBA" to see color components with actual colors (Red=red, Green=green, Blue=blue, Alpha=gray)
- Double-click "DOS DateTime" to see Year, Month, Day, Hour, Minute, Second fields

### Operations

| Operation | Description                                     |
| --------- | ----------------------------------------------- |
| BSWAP     | Byte-swap (reverse endianness)                  |
| NOT       | Bitwise complement                              |
| ROL       | Rotate left (bits wrap around)                  |
| ROR       | Rotate right (bits wrap around)                 |
| SAL       | Shift arithmetic left (preserves sign bit)      |
| SAR       | Shift arithmetic right (sign-extending)         |
| SHL       | Shift logical left (zero-fill, multiply by 2^n) |
| SHR       | Shift logical right (zero-fill, divide by 2^n)  |

### Code Export

Generate production-ready code for defined fields in C, C++, or C#:

```c
// C/C++ output
#define FLAGS_MASK  0x000000FFU
#define FLAGS_POS   0
#define GET_FLAGS(v) (((v) >> FLAGS_POS) & 0xFFU)
#define SET_FLAGS(v, x) (((v) & ~FLAGS_MASK) | (((x) & 0xFFU) << FLAGS_POS))
```

```csharp
// C# output
public const uint FlagsMask = 0x000000FF;
public static uint GetFlags(uint v) => (uint)((v >> FlagsPos) & 0xFF);
```

## Bit Widths

- **8-bit** (byte)
- **16-bit** (word/short)
- **32-bit** (dword/int)
- **64-bit** (qword/long)

Select width from header buttons. Formats filter based on available bits.

## Live Demo

Open [index.html](index.html) in any modern browser - no build required.

## Technical Details

**Stack:**

- React 18 (CDN)
- Tailwind CSS (CDN)
- Babel (JSX transformation)
- Pure JavaScript with BigInt

**Browser Requirements:**

- BigInt support (ES2020+)
- DataView API
- Clipboard API

## Feature Set

### Implemented

- [x] Hex/Dec/Oct/Bin/Float input modes
- [x] Float mode math expression evaluator (formulas, functions, constants)
- [x] Function autocomplete with descriptions
- [x] Signed/Unsigned integer views (8/16/32/64-bit)
- [x] Little Endian and Big Endian support
- [x] IEEE 754 Float16/32/64
- [x] BFloat8/16/32/64 (Brain Float family)
- [x] Minifloat (8-bit)
- [x] FP8 E4M3/E5M2 (ML inference/training formats)
- [x] Decimal8/16/32/64 (custom and IEEE 754 BID)
- [x] Posit format (8/16/32-bit)
- [x] TensorFloat-32 (NVIDIA tensor core)
- [x] IBM Hexadecimal Floating Point
- [x] VAX F_floating
- [x] Microsoft Binary Format (MBF)
- [x] Fixed-point Q formats (Q7.8, Q15.16, Q31.32, UQ8.8, UQ16.16, UQ32.32)
- [x] Packed BCD
- [x] OLE Currency
- [x] Unix/DOS/FILETIME timestamps
- [x] NTP, OLE Date, HFS+, GPS, WebKit, .NET Ticks timestamps
- [x] RGB/RGBA colors
- [x] RGB565, RGB555, ARGB1555 (16-bit colors)
- [x] BGR24, BGRA32, ABGR32 (Windows color formats)
- [x] HSV color representation
- [x] IPv4 address format
- [x] IPv6 address (lower 64 bits)
- [x] TCP/UDP port numbers with well-known names
- [x] MAC-48 address format
- [x] FourCC codes
- [x] mu-law/A-law audio codecs (G.711)
- [x] MIDI note numbers
- [x] ASCII/EBCDIC/UTF-32 character display
- [x] Gray code (reflected binary)
- [x] Zigzag encoding (Protocol Buffers) - 8/16/32/64-bit
- [x] Separate Colors/DateTime/Audio categories
- [x] Type name aliases
- [x] Interactive bit grid
- [x] Named field definitions
- [x] Quick field loading via double-click (loads format bit components)
- [x] Color-coded fields for RGB/RGBA (red, green, blue, alpha bits)
- [x] Shift (SHL/SAL/SHR/SAR), rotate (ROL/ROR), NOT, BSWAP operations
- [x] Random value generator (dice button)
- [x] Automatic array display when width exceeds type size
- [x] Popcount, parity, CLZ, CTZ, CLO, CTO
- [x] C/C++/C# code generation

### Planned Features

- [ ] IEEE 754 Decimal128 (requires 128-bit support)
- [ ] .NET Decimal (128-bit)
- [ ] AND/OR/XOR with second operand
- [ ] Bit range selection
- [ ] Import/export field definitions
- [ ] URL state persistence
- [ ] Keyboard shortcuts
- [ ] GUID/UUID interpretation (requires 128-bit support)
- [ ] Full IPv6 address view (requires 128-bit support)

## Known Limitations

- Float16 and exotic floats use JavaScript approximation
- No 128-bit width support (limits GUID/UUID, full IPv6)
- Field overlap detection not implemented
- Some exotic formats (VAX, IBM) may have edge-case inaccuracies
- Custom Decimal8/16 formats are non-standard (IEEE only defines 32/64/128)
- BFloat8/32/64 are custom extensions (only BFloat16 is standard)

## License

Part of the »SynthelicZ« project collection. See repository root for license.
