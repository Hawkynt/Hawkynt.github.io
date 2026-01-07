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

## Supported Formats

### Integers

| Type     | Aliases                                               | Sizes  |
| -------- | ----------------------------------------------------- | ------ |
| Signed   | `SByte`, `Int8`, `sbyte`, `i8`, `char`, `signed char` | 8-bit  |
| Signed   | `Short`, `Int16`, `short`, `i16`                      | 16-bit |
| Signed   | `Int`, `Int32`, `int`, `i32`, `long`                  | 32-bit |
| Signed   | `Long`, `Int64`, `long long`, `i64`                   | 64-bit |
| Unsigned | `Byte`, `UInt8`, `byte`, `u8`, `BYTE`, `unsigned char`| 8-bit  |
| Unsigned | `Word`, `UInt16`, `ushort`, `u16`, `word`, `WORD`     | 16-bit |
| Unsigned | `DWord`, `UInt32`, `uint`, `u32`, `dword`, `DWORD`    | 32-bit |
| Unsigned | `QWord`, `UInt64`, `ulong`, `u64`, `qword`, `QWORD`   | 64-bit |
| Gray Code| `Gray8`, `Gray16`, `Gray32`, `Gray64`                 | 8-64   |
| Zigzag   | `Zigzag32`, `Zigzag64`, `sint32`, `sint64`            | 32/64  |

All multi-byte integers available in both LE and BE variants.

**Automatic Array Display**: When the bit width exceeds the type size, values are displayed as arrays. For example, at 32-bit width:

- `Byte` shows `[ 175, 219, 131, 238 ]` (4 bytes)
- `Word` shows `[ 56239, 61059 ]` (2 words)
- `DWord` shows `4001618863` (single value)

### IEEE 754 Floats

| Format | Aliases                                        | Size   | Structure  |
| ------ | ---------------------------------------------- | ------ | ---------- |
| Double | `Float64`, `double`, `f64`, `Double`           | 64-bit | 1s/11e/52m |
| Half   | `Float16`, `half`, `f16`, `binary16`, `__fp16` | 16-bit | 1s/5e/10m  |
| Single | `Float32`, `float`, `f32`, `single`, `Single`  | 32-bit | 1s/8e/23m  |

### Exotic Float Formats

| Format    | Aliases                        | Size   | Description                    |
| --------- | ------------------------------ | ------ | ------------------------------ |
| BFloat16  | `bf16`, `brain float`          | 16-bit | Google Brain format (1s/8e/7m) |
| Decimal32 | `_Decimal32`                   | 32-bit | IEEE 754 decimal float (BID)   |
| Decimal64 | `_Decimal64`                   | 64-bit | IEEE 754 decimal float (BID)   |
| FP8-E4M3  | `E4M3`, `fp8`                  | 8-bit  | ML inference (1s/4e/3m)        |
| FP8-E5M2  | `E5M2`                         | 8-bit  | ML training (1s/5e/2m)         |
| IBM HFP   | `IBM Float`, `hex float`       | 32-bit | IBM Hexadecimal Floating Point |
| MBF32     | `MS Binary`, `BASIC float`     | 32-bit | Microsoft Binary Format        |
| MBF64     | `MS Binary 64`, `BASIC double` | 64-bit | Microsoft Binary Format        |
| Minifloat | `float8`                       | 8-bit  | 1s/4e/3m, bias=7               |
| Posit8    | `posit<8,0>`                   | 8-bit  | Posit unum type III (es=0)     |
| Posit16   | `posit<16,1>`                  | 16-bit | Posit unum type III (es=1)     |
| Posit32   | `posit<32,2>`                  | 32-bit | Posit unum type III (es=2)     |
| TF32      | `TensorFloat-32`               | 32-bit | NVIDIA tensor core (1s/8e/10m) |
| VAX F     | `F_floating`, `VAX float`      | 32-bit | DEC VAX F_floating format      |

### Fixed Point

| Format  | Size   | Description                |
| ------- | ------ | -------------------------- |
| Q7.8    | 16-bit | Signed 8.8 fixed point     |
| Q15.16  | 32-bit | Signed 16.16 fixed point   |
| Q31.32  | 64-bit | Signed 32.32 fixed point   |
| UQ8.8   | 16-bit | Unsigned 8.8 fixed point   |
| UQ16.16 | 32-bit | Unsigned 16.16 fixed point |

### Decimal / BCD

| Format | Size   | Description            |
| ------ | ------ | ---------------------- |
| BCD8   | 8-bit  | Packed BCD (2 digits)  |
| BCD16  | 16-bit | Packed BCD (4 digits)  |
| BCD32  | 32-bit | Packed BCD (8 digits)  |
| BCD64  | 64-bit | Packed BCD (16 digits) |

### Characters

| Format  | Aliases                     | Size   | Description                       |
| ------- | --------------------------- | ------ | --------------------------------- |
| ASCII   | `Char`, `char`              | 8-bit  | ASCII character with ctrl names   |
| ASCII16 | `Chars16`                   | 16-bit | 2 ASCII characters                |
| ASCII32 | `Chars32`                   | 32-bit | 4 ASCII characters                |
| ASCII64 | `Chars64`                   | 64-bit | 8 ASCII characters                |
| EBCDIC  |                             | 8-bit  | IBM mainframe character encoding  |
| UTF-32  | `Unicode`, `UCS-4`          | 32-bit | Full Unicode code point           |

### Colors

| Format   | Aliases              | Size   | Description                |
| -------- | -------------------- | ------ | -------------------------- |
| ABGR32   | `ABGR`               | 32-bit | Alpha-Blue-Green-Red       |
| ARGB1555 | `16-bit ARGB`        | 16-bit | 15-bit color + 1-bit alpha |
| ARGB4444 | `4444`               | 16-bit | 16-bit color (4/4/4/4)     |
| BGR24    | `BGR`, `COLORREF`    | 32-bit | Windows bitmap color order |
| BGRA32   | `BGRA`               | 32-bit | Windows bitmap with alpha  |
| HSV      | `HSB`                | 32-bit | Hue/Saturation/Value color |
| RGB      | `RGB24`, `color`     | 32-bit | RGB color (0x00RRGGBB)     |
| RGB555   | `15-bit Color`       | 16-bit | 15-bit color (5/5/5)       |
| RGB565   | `16-bit Color`       | 16-bit | 16-bit color (5/6/5)       |
| RGBA     | `RGBA32`, `ARGB`     | 32-bit | RGBA color (0xAARRGGBB)    |

### Date/Time

| Format       | Aliases                  | Size   | Description            |
| ------------ | ------------------------ | ------ | ---------------------- |
| .NET Ticks   | `DateTime.Ticks`         | 64-bit | 100ns since 0001-01-01 |
| DOS DateTime | `FAT timestamp`          | 32-bit | DOS/FAT date+time      |
| FILETIME     | `Windows FILETIME`       | 64-bit | 100ns since 1601-01-01 |
| GPS Time     | `GPS`                    | 32-bit | Seconds since 1980-01-06 |
| HFS+         | `Mac Time`, `HFSPlusDate`| 32-bit | Seconds since 1904-01-01 |
| NTP          | `NTP Timestamp`          | 64-bit | 32.32 fixed since 1900 |
| OLE Date     | `Automation Date`, `DATE`| 64-bit | Days since 1899-12-30  |
| Unix32       | `time_t`, `Unix timestamp`| 32-bit | Seconds since 1970-01-01 |
| Unix64       | `time64_t`               | 64-bit | Seconds since 1970-01-01 |
| WebKit       | `Chrome Time`            | 64-bit | Microseconds since 1601 |

### Audio

| Format   | Aliases              | Size  | Description               |
| -------- | -------------------- | ----- | ------------------------- |
| A-law    | `alaw`, `G.711A`     | 8-bit | ITU-T G.711 A-law codec   |
| MIDI Note| `MIDI`, `note`       | 8-bit | MIDI note number (0-127)  |
| μ-law    | `mu-law`, `G.711μ`   | 8-bit | ITU-T G.711 μ-law codec   |

### Special Formats

| Format   | Aliases                       | Size   | Description              |
| -------- | ----------------------------- | ------ | ------------------------ |
| Currency | `OLE Currency`, `money`, `CY` | 64-bit | Scaled integer /10000    |
| FourCC   | `FOURCC`, `magic`             | 32-bit | Four-character code      |
| IPv4     | `IP Address`, `in_addr`       | 32-bit | Dotted decimal format    |
| IPv6 (low)| `IPv6-L`                     | 64-bit | Lower 64 bits of IPv6    |
| MAC      | `MAC-48`, `EUI-48`            | 64-bit | Colon-separated MAC addr |
| Port     | `TCP Port`, `UDP Port`        | 16-bit | Well-known port numbers  |

## How It Works

### Input Modes

Enter values in multiple formats:

- **Hex**: `0xDEADBEEF` or `DEADBEEF`
- **Decimal**: `3735928559`
- **Signed**: `-559038737`
- **Binary**: `0b1101...`
- **Octal**: `0o33653337357`

### Type Interpretations

The left panel shows the current bit pattern interpreted as every applicable format. Categories can be expanded/collapsed:

- **Integers**: Signed and unsigned in LE/BE, Gray code, Zigzag encoding
- **IEEE 754 Floats**: Half, single, double precision
- **Exotic Floats**: BFloat16, IBM, VAX, MBF, FP8 (ML) formats
- **Fixed Point**: Q-format fixed point numbers
- **Decimal/BCD**: Binary Coded Decimal
- **Colors**: RGB, RGBA, BGR, HSV, and 16-bit color formats
- **Date/Time**: Unix, DOS, FILETIME, NTP, and other timestamps
- **Audio**: μ-law, A-law, MIDI note numbers
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

| Operation | Description                                    |
| --------- | ---------------------------------------------- |
| BSWAP     | Byte-swap (reverse endianness)                 |
| NOT       | Bitwise complement                             |
| ROL       | Rotate left (bits wrap around)                 |
| ROR       | Rotate right (bits wrap around)                |
| SAL       | Shift arithmetic left (preserves sign bit)     |
| SAR       | Shift arithmetic right (sign-extending)        |
| SHL       | Shift logical left (zero-fill, multiply by 2^n)|
| SHR       | Shift logical right (zero-fill, divide by 2^n) |

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

- [x] Hex/Dec/Oct/Bin input modes
- [x] Signed/Unsigned integer views (8/16/32/64-bit)
- [x] Little Endian and Big Endian support
- [x] IEEE 754 Float16/32/64
- [x] BFloat16 (Brain Float)
- [x] Minifloat (8-bit)
- [x] FP8 E4M3/E5M2 (ML inference/training formats)
- [x] IEEE 754 Decimal32/64 (BID encoding)
- [x] Posit format (8/16/32-bit)
- [x] TensorFloat-32 (NVIDIA tensor core)
- [x] IBM Hexadecimal Floating Point
- [x] VAX F_floating
- [x] Microsoft Binary Format (MBF)
- [x] Fixed-point Q formats
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
- [x] μ-law/A-law audio codecs (G.711)
- [x] MIDI note numbers
- [x] ASCII/EBCDIC/UTF-32 character display
- [x] Gray code (reflected binary)
- [x] Zigzag encoding (Protocol Buffers)
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

## License

Part of the »SynthelicZ« project collection. See repository root for license.
