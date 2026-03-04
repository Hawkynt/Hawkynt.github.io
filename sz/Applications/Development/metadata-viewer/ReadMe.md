# Metadata Viewer

File analysis and metadata editor for the SZ desktop environment.

## Purpose

Drop any file onto the Metadata Viewer to identify its type via magic bytes (not file extensions), view format-specific metadata in a categorized UI, see embedded images (EXIF thumbnails, album art), compute cryptographic hashes, and edit certain metadata fields.

## How It Works

1. **File Identification** -- A magic byte table (100+ signatures) identifies the file type in two passes: direct signature matching (magic bytes, RIFF fourcc, ISO BMFF ftyp brands), then heuristic detection for text-based formats, ZIP containers (OOXML, JAR, APK, EPUB, ODF), shebangs, PEM certificates, and more.
2. **Format Parsing** -- Format-specific parsers extract metadata into categorized field sets. All parsing is pure `DataView`/`Uint8Array` operations with no external libraries.
3. **Hash Computation** -- 29 hash/checksum algorithms grouped into Cryptographic (MD5, SHA-1/224/256/384/512, SHA-512/256, SHA3-256/384/512, BLAKE2b/2s, BLAKE3, RIPEMD-160, Whirlpool, Tiger, SM3, Streebog-256), Non-Cryptographic (xxHash32, xxHash3, MurmurHash3), and Checksums (CRC-16/32/64, Adler-32, Fletcher-32, BSD, Sum-8, XOR-8) are computed using the Cipher project's `AlgorithmFramework`. Large files are processed in 512KB chunks via `setTimeout` to avoid blocking the UI.
4. **Metadata Editing** -- Writable formats (MP3 ID3 tags, PNG text chunks, JPEG EXIF fields, MP4 iTunes atoms, Office document properties) support inline field editing with rich edit controls (number, date picker, select dropdown, image replace/remove, geo coordinate picker) and file reconstruction on save.
5. **PE Detection** -- Executable analysis includes packer/protector/compiler/framework detection via section names, string scanning, import analysis, and a 4,400+ entry signature database converted from ExeInfo ASL's userdb.txt format.
6. **PE Resources** -- Resource directory (Data Directory[2]) is walked to extract RT_ICON, RT_BITMAP, RT_VERSION, and RT_MANIFEST entries. ICO files are reconstructed from RT_GROUP_ICON + RT_ICON entries; bitmaps get BITMAPFILEHEADER prepended; version info (StringFileInfo) is parsed for FileDescription, ProductName, etc.; manifests are shown as XML text.
7. **Embedded Strings** -- PE sections are scanned for printable ANSI (ASCII runs >= 4 chars) and Unicode (UTF-16LE with full BMP support, >= 4 chars) strings. Results are deduplicated by value, sorted by file offset, and shown in a searchable/filterable tab (filter only visible on the Strings tab) with encoding badges (ANSI/UTF-16/Unicode) and section names.
8. **.NET Assembly View** -- When CLR metadata is present, a namespace > type > member tree is built from TypeDef, MethodDef, Field, and Param tables. Method signatures are decoded from #Blob heap using the ECMA-335 compressed format including generic instantiations. Each method's IL body is individually addressable via the method picker dropdown in the MSIL disassembly panel. Per-method context (local variable types from StandAloneSig/LocalVarSig, exception handling clauses from fat method headers, parameter names/types from Param table) is extracted and threaded to the decompiler.
9. **Disassembly** -- Executable entry-point code is disassembled using architecture-specific decoders (x86/x64, ARM/ARM64, Java bytecode, .NET MSIL, PowerPC, Dalvik, 6502/65C816, Z80, Motorola 68000, Python bytecode, VB6 P-code, Dart Kernel) with pseudo-C annotation, displayed in the accordion preview panel. PE and ELF executables get rich annotations: import/export/string cross-references are resolved and shown as inline comments, jump/call targets are clickable for navigation, label lines mark branch targets, and a cross-references panel lists all imports used, strings referenced, internal call targets, and exports. Navigation toolbar provides back/forward history and address bar; scrolling near the bottom auto-loads more instructions seamlessly. A view mode combobox allows switching between output modes (Assembly/Pseudo-C for x86, IL/Pseudo-C#/Pseudo-VB/C# simplified for MSIL, JIL/Java/Kotlin for Java bytecode). The MSIL decompiler pipeline produces structured C#-like output in three stages: (1) stack-tracking expression builder converts IL instructions to flat goto-based statements with named parameters, typed locals, and full call resolution (properties, events, operators, string concatenation); (2) control flow reconstruction wraps EH clauses into try/catch/finally blocks (ECMA-335 II.25.4.6 small/fat format) then pattern-matches goto sequences into structured if/else, while, do-while, for loops, and switch/case — unmatched gotos remain as `goto IL_XXXX;`; (3) pattern recognition collapses try/finally+Dispose into `using`, GetEnumerator+try/MoveNext+finally/Dispose into `foreach`, Monitor.Enter/Exit into `lock`, and detects compound assignments, ternary operators, and for-loop init/increment. The Pseudo-VB mode converts structured C# output to VB.NET syntax (While/End While, For Each/Next, Try/Catch/Finally/End Try, Using/End Using, SyncLock/End SyncLock, Select Case, CType casts, AndAlso/OrElse). The modern C# (simplified) mode adds deeper pattern detection: async/await reconstruction (GetAwaiter/GetResult → `await`), compiler-generated name cleanup (DisplayClass → closure, state machine fields), String.Format → string interpolation `$"..."`, null-conditional `?.` and null-coalescing `??` operators, pattern matching `is Type t`, and nullable pattern simplification (.HasValue → != null). User string literals are resolved from the #US heap. Method headers show access modifiers, return type, and typed parameter names.

## Supported Formats

| Category | Formats |
|----------|---------|
| Image | JPEG (EXIF/JFIF/GPS), PNG, GIF, BMP, TIFF, WebP, ICO, CUR, PSD, JPEG 2000, JPEG XL, JPEG XR, OpenEXR, GIMP XCF, WMF, FLIF, BPG, EPS, HEIC, AVIF |
| Audio | MP3 (ID3v1/ID3v2/MPEG frame), FLAC, OGG Vorbis, WAV, AIFF, MIDI, DSF, DFF, APE, AAC-ADTS, M4A |
| Video | MP4/M4V (ISO BMFF), MKV/WebM (EBML), AVI, ASF/WMV/WMA, FLV, MPEG-PS, MPEG-TS, MPEG Video, AV1, 3GPP, QuickTime |
| Document | PDF, RTF, DjVu, CHM, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), OpenDocument (ODF), EPUB, Legacy Office (.doc/.xls/.ppt via OLE2) |
| Executable | PE (.exe/.dll), ELF, Mach-O, Java .class, Android DEX/OAT/VDEX/ART, Python .pyc, Dart Kernel (.dill), WebAssembly, Lua bytecode, Script files (shebang detection), MetaTrader EA (.ex4/.ex5) |
| Debug | Microsoft PDB |
| Archive | ZIP, RAR (v1.5/v5), 7Z, GZIP, TAR, XZ, LZ4, LZIP, Zstandard, BZip2, ARJ, Microsoft Cabinet, XAR, JAR, APK (deep), CRX, DEB, RPM |
| Data | SQLite, MDB (Access), HDF5, XML, JSON, HTML, SVG, CSS, YAML, INI, iCalendar, vCard, PEM certificates, PGP/GPG, ISO 9660, LNK, VHD/VHDX |
| Retro ROM | NES (iNES), Game Boy, Sega Master System, Sega Genesis/Mega Drive, SNES, Commodore 64 .prg, Amiga Hunk |
| Font | TTF, OTF, WOFF, WOFF2 |

## Architecture

```
pe-signatures.js       -- SZ.PESignatures: 4,400+ PE packer/compiler/protector signatures (ExeInfo ASL format)
parsers-core.js        -- SZ.MetadataParsers: magic byte table, identify(), parse(), utilities, registerParsers()
parsers-image.js       -- Image parsers: JPEG (EXIF/IPTC/JFIF/GPS), PNG, GIF, BMP, ICO, PSD, WebP, TIFF
parsers-audio.js       -- Audio parsers: MP3 (ID3v1/v2), FLAC, WAV, OGG
parsers-video.js       -- Video parsers: MP4/M4V (ISO BMFF), MKV/WebM (EBML)
parsers-document.js    -- Document parsers: PDF, OOXML, OLE2
parsers-archive.js     -- Archive parsers: ZIP, JAR, APK (with binary XML)
parsers-executable.js  -- Executable parsers: PE, ELF, Mach-O, Java .class, PDB, EX4/EX5, DEX, OAT, VDEX, ART, PYC, Dart Kernel
parsers-font.js        -- Font parsers: TTF, OTF, WOFF, WOFF2
parsers-retro.js       -- Retro ROM parsers: NES, Game Boy, SMS, Genesis, SNES, C64 .prg, Amiga Hunk
disasm-core.js         -- SZ.Disassembler: registration, dispatch, formatting framework (16 architectures)
disasm-x86.js          -- x86/x64 variable-length instruction decoder
disasm-arm.js          -- ARM32 + ARM64/AArch64 instruction decoder
disasm-java.js         -- Java bytecode (JVM) instruction decoder
disasm-msil.js         -- .NET CIL/MSIL instruction decoder
disasm-powerpc.js      -- PowerPC 32-bit instruction decoder
disasm-dalvik.js       -- Android Dalvik bytecode decoder (register-based VM, ~220 opcodes)
disasm-6502.js         -- MOS 6502 + WDC 65C816 decoder (NES, C64, SNES)
disasm-z80.js          -- Zilog Z80 decoder with Game Boy mode (Master System, Game Boy, ZX Spectrum)
disasm-m68k.js         -- Motorola 68000 decoder (Amiga, Atari ST, Sega Genesis)
disasm-python.js       -- Python bytecode decoder (3.6-3.12 wordcode)
disasm-vbpcode.js      -- Visual Basic 6 P-code decoder
disasm-dart.js         -- Dart Kernel (.dill) AST summary
editors.js             -- SZ.MetadataEditors: isEditable(), rebuildFile(), CRC32, ID3/PNG/EXIF/MP4/OOXML writers
controller.js          -- App logic: state, UI, file loading, drag-drop, hash computation, editing
styles.css             -- SZ theme-aware styling
index.html             -- HTML structure + Cipher script tags
```

### Modular Parser Architecture

The monolithic `parsers.js` has been split into a core module (`parsers-core.js`) and format-specific modules (`parsers-image.js`, `parsers-audio.js`, etc.). Each module is an IIFE that calls `SZ.MetadataParsers.registerParsers()` to register its parsers. All modules share utilities exported by the core module. Loading order: core first, then any format modules (order among format modules does not matter).

### Parsers as Shared Library

`parsers-core.js` and the `parsers-*.js` modules export `SZ.MetadataParsers` on `window.SZ`. The Explorer app loads them via `<script src="../metadata-viewer/parsers-*.js">` to power its Properties dialog, with no code duplication.

### PE Signature Database

`pe-signatures.js` exports `SZ.PESignatures` -- an array of 4,400+ entry-point byte signatures converted from ExeInfo ASL's `userdb.txt` format. The PE parser matches these against the entry point bytes of executables to identify packers, protectors, compilers, and frameworks. The `_convert_userdb.js` script converts the raw userdb.txt to compact JS format.

### Cipher Integration

Hash/checksum algorithms are loaded from the Cipher project via `<script>` tags. The `AlgorithmFramework.Find(name)` API provides `CreateInstance()` with the `Feed()/Result()` pattern for streaming computation.

### Disassembler Framework

`disasm-core.js` exports `SZ.Disassembler` with `registerDisassembler(archId, decoderFn)`, `disassemble(archId, bytes, offset, count)`, and `formatDisassembly(instructions)`. 16 architecture modules each register a batch-mode decoder that returns arrays of instruction objects with offset, length, bytes, mnemonic, operands, and pseudo-C fields:

| Architecture | Module | Platforms |
|---|---|---|
| x86/x64 | disasm-x86.js | Windows PE, ELF |
| ARM32/ARM64 | disasm-arm.js | iOS Mach-O, ELF |
| Java bytecode | disasm-java.js | Java .class |
| .NET MSIL | disasm-msil.js | .NET assemblies |
| PowerPC | disasm-powerpc.js | ELF (PPC) |
| Dalvik | disasm-dalvik.js | Android DEX |
| MOS 6502 | disasm-6502.js | NES, C64, Apple II, Atari |
| WDC 65C816 | disasm-6502.js (65C816 mode) | SNES |
| Zilog Z80 | disasm-z80.js | Master System, ZX Spectrum, MSX |
| Z80 (Game Boy) | disasm-z80.js (GB mode) | Game Boy |
| Motorola 68000 | disasm-m68k.js | Amiga, Atari ST, Sega Genesis |
| Python bytecode | disasm-python.js | Python .pyc |
| VB6 P-code | disasm-vbpcode.js | VB6 P-code EXEs |
| Dart Kernel | disasm-dart.js | Dart .dill |

The executable and retro ROM parsers detect the architecture and emit a `disassembly` property with `archId` and entry-point file offset, which the controller uses to render the Disassembly accordion section. PE and ELF parsers additionally emit rich annotation data: `imageBase`, `sections`, `imports` (IAT address to DLL!function name map), `exports` (RVA to export name map), `strings` (RVA to extracted ASCII string map), and `codeSection` boundaries. The disassembly formatter uses these to produce clickable addresses, label lines at jump targets, and inline annotation comments showing resolved import/export/string names. The controller provides navigation (back/forward/goto address), seamless scroll-based auto-loading, and a cross-references panel listing all imports, strings, calls, and exports found in the current disassembly.

## Editing Support

| Format | Editable Fields | Strategy |
|--------|----------------|----------|
| MP3 (ID3v2) | Title, Artist, Album, Year, Genre, Track, Comment, Composer, Album Artist, Disc, BPM, Copyright, Publisher, and 30+ more frame types | Rebuild entire ID3v2 tag; genre autocomplete with 192 standard genres |
| MP3 (ID3v1) | Title, Artist, Album, Year, Comment | Overwrite fixed-offset fields |
| PNG (tEXt/iTXt) | All text chunks | Walk chunks, replace/insert, recalculate CRC32 |
| JPEG (EXIF) | Make, Model, Software, Artist, Copyright, ImageDescription, Orientation, DateTime, DateTimeOriginal, DateTimeDigitized, GPS Coordinates, Altitude, Image Direction, Destination (target coordinates, bearing, distance) | Full IFD rebuild engine (ASCII, SHORT, LONG, RATIONAL types), add/remove tags, GPS IFD creation from scratch |
| JPEG (IPTC) | Country, State/Province, City, Sub-Location, Country Code | Create/modify APP13 Photoshop 3.0 / 8BIM / IIM datasets |
| MP4/M4A (ilst) | Title, Artist, Album, Year, Genre, Comment, Composer, Copyright | Modify/create iTunes ilst atoms in moov/udta/meta |
| OOXML (docx/xlsx/pptx) | Title, Subject, Author, Keywords, Description, Category | Modify docProps/core.xml in ZIP container |

## Dual-Nature File Detection

Files that are both an archive and a specific format (e.g., DOCX = ZIP + Word document, JAR = ZIP + Java archive) display metadata from both the container format and the specific format. The parser runs both the format-specific parser and the ZIP parser, merging their categories.

## PE Executable Detection

The PE parser provides multi-layered detection:

| Layer | Detection Method | Examples |
|-------|-----------------|----------|
| Section names | Known packer/protector section names | UPX, .vmp (VMProtect), .themida, .aspack, .petite |
| Rich header | MSVC toolchain presence | Microsoft Visual C++ |
| String scanning | Embedded compiler/framework strings | Go runtime, Rust, Delphi, .NET, Electron, Qt, NSIS, Inno Setup |
| Import DLLs | Known runtime library imports | cygwin1.dll, vcruntime, borlndmm.dll, node.dll |
| Entry point bytes | ExeInfo ASL signature database (4,400+ patterns) | Specific packer/compiler/protector version identification |
| Overlay data | Data appended after PE image | Installer payloads, embedded resources |

## Legacy Office (OLE2) Parsing

Legacy `.doc`, `.xls`, `.ppt` files using the OLE2 Compound Document format (magic bytes `D0 CF 11 E0`) are parsed by reading the FAT sector chain and directory entries. The parser identifies the document type from stream names (WordDocument, Workbook, PowerPoint Document, VisioDocument) and extracts metadata from the SummaryInformation and DocumentSummaryInformation property streams (title, subject, author, keywords, creation/modification dates, page/word counts, etc.).

## UI Layout

- **Menu Bar**: File, Edit, View, Help
- **File Header**: Type badge, filename, detected type, size, "Open in Archiver" button for archive types
- **Category Tabs**: General + format-specific + Hashes & Checksums
- **Metadata Table**: Key-value pairs with inline editing for writable fields
- **Resizable Splitter**: Draggable divider between left metadata panel and right preview panel (20-80% range)
- **Accordion Preview Panel**: Dynamic sections that auto-expand based on file type:
  - **Embedded Images**: Thumbnails, EXIF images, album art, APK icons
  - **Waveform**: PCM waveform for WAV, byte-amplitude density for compressed audio
  - **Hex Preview**: Color-coded first 256 bytes with byte regions mapped to parsed metadata fields
  - **Text Preview**: First 4KB decoded as text with non-printable character markers
  - **Unicode Preview**: BOM-aware decoding with code point annotations for non-ASCII characters
  - **Disassembly**: Entry-point instruction disassembly for executables and ROMs (16 architectures) with pseudo-C comments, clickable jump/call targets, annotation comments (resolved imports/strings/exports), navigation toolbar (back/forward/goto/address bar), scroll-based auto-loading, cross-references panel, and view mode combobox (Assembly/Pseudo-C for x86, IL/C#/VB for MSIL, JIL/Java/Kotlin for Java). Formats with multiple code types (e.g. .NET = x86 entry stub + MSIL, VB6 = x86 + P-Code) get separate accordion panels, each with independent navigation. .NET assemblies include a method picker dropdown for navigating to individual method IL bodies
- **Status Bar**: File type, size, entropy, modification count

## Running

Open `index.html` in a browser, or launch from the SZ desktop Start Menu under "Development".

## Features

- [x] Magic byte file identification (100+ formats)
- [x] Format-specific metadata parsing
- [x] Modular parser architecture (core + format-specific modules with hot registration)
- [x] EXIF data extraction (IFD0, SubIFD, GPS, Thumbnail IFD) with 80+ tags and human-readable values
- [x] IPTC metadata parsing for JPEG (APP13/Photoshop 3.0/8BIM resource blocks)
- [x] GPS coordinates displayed in DMS format (e.g., 48° 51' 24.00" N)
- [x] ID3v1/v2 tag parsing with album art extraction (50+ frame types)
- [x] Genre autocomplete with 192 standard ID3 genres
- [x] PE deep analysis (sections, imports, exports, .NET CLR)
- [x] PE import expansion (individual function names per DLL, expandable/collapsible rows)
- [x] PE packer/protector/compiler/framework detection (section names, strings, imports)
- [x] PE entry-point signature matching (4,400+ ExeInfo ASL signatures)
- [x] ELF deep analysis (sections, program headers, linked libraries, compiler detection)
- [x] Mach-O deep analysis (segments, linked libraries, build version, compiler detection)
- [x] Microsoft PDB detection and header parsing (page size, stream info)
- [x] MetaTrader EA detection (.ex4/.ex5 via extension-based identification)
- [x] OOXML detection and Office document metadata parsing (docx/xlsx/pptx)
- [x] Legacy Office (OLE2) detection and metadata parsing (doc/xls/ppt)
- [x] Dual-nature file detection (ZIP + document/archive metadata merged)
- [x] JAR file identification and parsing (manifest, class listing, packages)
- [x] Hash/checksum computation (29 algorithms via Cipher project, grouped by category)
- [x] Async chunked hashing for large files
- [x] Inline metadata editing (MP3 ID3, PNG text chunks, JPEG EXIF, MP4 iTunes, OOXML properties)
- [x] Rich edit types: text, number, date picker, select dropdown, image replace/remove/regenerate, geo coordinate picker, compass angle
- [x] GeoSetter-style GPS editor: movable/resizable MDI sub-window with OSM map, SVG FOV cone overlay, forward/reverse geocoding (Nominatim), compass widget, altitude, DMS display, direction reference (True/Magnetic North), destination target marker (right-click to place, with bearing/distance), and IPTC location fields (country code, country, state, city, sub-location)
- [x] Full EXIF IFD rebuild engine: add/remove/modify tags, RATIONAL type support, GPS IFD creation from scratch
- [x] IPTC APP13 writing (City, Sub-Location, State, Country, Country Code) with create-from-scratch support
- [x] GPS coordinate writing to EXIF via geo picker (latitude, longitude, altitude, image direction) with map search bar for forward geocoding
- [x] "Add EXIF Tag" dialog for JPEG with EXIF and GPS tag groups
- [x] MP4/M4A iTunes metadata parsing and cover art extraction
- [x] File reconstruction and save
- [x] Embedded image preview with save
- [x] Color-coded hex preview with byte regions mapped to parsed metadata fields
- [x] Text preview (first 4KB with non-printable markers and region coloring)
- [x] Unicode preview (BOM-aware with code point annotations)
- [x] Waveform preview (PCM for WAV, byte-amplitude for compressed audio)
- [x] Disassembly preview for executables and retro ROMs (entry point instructions with pseudo-C comments)
- [x] Enhanced disassembly viewer with clickable jump/call targets, icon toolbar (back/forward/up/home/copy), view mode selector, and scroll-based auto-loading
- [x] Disassembly annotations: import calls show resolved DLL!function names, string references show extracted strings, export addresses show export names
- [x] Disassembly labels: jump/call target addresses get `loc_XXXXXXXX:` label lines for readability
- [x] Cross-references panel: lists imports used, strings referenced, internal call targets, and exports found in disassembled code
- [x] Section-aware instruction count: decodes up to 4096 instructions based on code section size (was 64)
- [x] PE disassembly enrichment: ImageBase, IAT import map, export RVA map, string table extraction from .rdata/.data
- [x] ELF disassembly enrichment: symbol table extraction (.dynsym/.symtab), string extraction from .rodata/.data
- [x] Multi-panel disassembly: formats with multiple code types (.NET = x86 + MSIL, VB6 = x86 + P-Code) get separate accordion panels with independent navigation
- [x] Multi-architecture disassembler (16 architectures: x86/x64, ARM/ARM64, Java, MSIL, PowerPC, Dalvik, 6502/65C816, Z80, 68000, Python, VB P-code, Dart) with syntax highlighting
- [x] Java bytecode constant pool resolution (class/method/field names in disassembly)
- [x] .NET MSIL metadata token resolution (type/method/field names from CLI metadata tables)
- [x] Android DEX full parsing (string/type/method/field tables, class definitions, Dalvik disassembly)
- [x] Android OAT/VDEX/ART header parsing
- [x] Python .pyc version detection and bytecode disassembly
- [x] Dart Kernel (.dill) header and library/class summary
- [x] VB6 P-code detection in PE executables and P-code disassembly
- [x] Retro ROM format parsers (NES iNES, Game Boy, Sega Master System, Sega Genesis, SNES LoROM/HiROM, C64 .prg, Amiga Hunk)
- [x] MOS 6502 disassembler with 65C816 SNES extension mode
- [x] Z80 disassembler with Game Boy restricted mode (no IX/IY/ED)
- [x] Motorola 68000 disassembler with full effective address decoding
- [x] Resizable splitter between metadata and preview panels
- [x] Accordion preview panel with smart auto-expansion by file type
- [x] Shannon entropy and encoding detection
- [x] Drag-and-drop file loading
- [x] VFS file open/save (with data URL decoding)
- [x] Click-to-copy hash values
- [x] Copy All Metadata to clipboard
- [x] Keyboard shortcuts (Ctrl+O, Ctrl+I, Ctrl+S)
- [x] PE resource extraction (RT_ICON/RT_BITMAP/RT_VERSION/RT_MANIFEST) with ICO reconstruction and BMP display
- [x] PE embedded strings tab with ANSI/UTF-16/Unicode extraction, deduplication, and real-time search filter (filter only on Strings tab)
- [x] .NET Assembly tree view (namespace > type > member hierarchy with Visual Studio-style SVG icons for classes/interfaces/structs/enums/records/delegates/methods/fields/properties/events, export button, hidden Property/Value headers)
- [x] .NET per-method IL body extraction via assembly tree click-to-navigate (fat header parsing: LocalVarSigTok, EH clauses, MoreSects)
- [x] .NET blob signature decoder (ECMA-335 method signatures to C#-like type names, generic instantiations, CMOD, pinned)
- [x] .NET StandAloneSig table storage and LOCAL_SIG decoding for typed local variable declarations
- [x] .NET exception handling clause parsing (ECMA-335 II.25.4.6 small/fat format, catch/finally/fault/filter)
- [x] .NET per-method context threading (local types, EH clauses, param info, method flags) from parser to decompiler
- [x] .NET #US (User Strings) heap resolution for ldstr instruction string literals
- [x] Disassembly view mode combobox: Assembly/Pseudo-C for x86, IL/Pseudo-C#/Pseudo-VB/C# simplified for MSIL, JIL/Java/Kotlin for Java
- [x] MSIL decompiler with control flow reconstruction: method headers with access modifiers and typed parameters, local variable declarations from StandAloneSig, structured if/else/while/do-while/for/switch (pattern-matched from goto sequences), try/catch/finally from EH clause parsing (ECMA-335 small/fat format), C# 2.0 pattern recognition (using/foreach/lock/compound assignments/ternary), modern C# patterns (async/await, string interpolation, null-conditional/coalescing, pattern matching `is Type t`), VB.NET structured block output (While/For Each/Try/Using/SyncLock), clean label renaming in decompiled modes (sequential `label_0`..`label_N` replacing raw IL offsets, no address column)
- [x] Java decompiler formatters (low-level Java, high-level Java, Kotlin syntax)
- [x] Category tab icons (Unicode emoji indicators per category type)
- [x] Enhanced general statistics (chi-square, serial correlation, Monte Carlo Pi, byte frequency analysis)
- [x] EXIF/JFIF null-byte header comparison fix for local file reading
- [x] Explorer Properties dialog integration
- [x] ISO BMFF brand detection (HEIC, AVIF, AV1, 3GPP, M4V, QuickTime, Canon RAW)
- [x] RIFF sub-type detection (WAV, AVI, WebP, ANI, MIDI, CorelDRAW)
- [x] Shebang script detection (Python, Bash, Node.js, Perl, Ruby, PHP)
- [x] Text format heuristics (PEM, iCalendar, vCard, CSS, YAML, INI)
- [x] ZIP container analysis (OOXML, JAR, APK, EPUB, ODF, browser extensions)
- [x] APK deep parsing (package name, permissions, SDK versions, DEX/native analysis, icon extraction)
- [x] "Open in Archiver" button for archive file types (24 archive formats supported)

## Planned Features

- [ ] zTXt (compressed text) PNG chunk support
- [ ] MKV/WebM Matroska tag editing
- [ ] Batch file analysis
- [ ] DEFLATE decompression for APK icon extraction from compressed entries
- [x] EXIF RATIONAL/SRATIONAL type editing (e.g., focal length, exposure time)
- [ ] ID3 APIC (album art) replace/remove via image edit type
- [ ] MP4 cover art replace/remove via image edit type
- [x] GPS coordinate writing to EXIF via geo picker
- [ ] EXIF thumbnail regeneration from main image

## Known Limitations

- JPEG EXIF editing uses full IFD rebuild; MakerNote data is preserved as raw bytes but internal absolute offsets may break on rewrite
- EXIF APP1 segment is limited to 64KB; large IFDs with many RATIONAL values may approach this limit
- Reverse geocoding requires internet access (Nominatim API, rate-limited to 1 req/sec)
- OOXML editing requires core.xml to be stored uncompressed (STORED method) in the ZIP container
- MKV/WebM metadata editing not yet supported (read-only)
- Hash computation requires the Cipher project scripts to be loadable
- EXIF parsing handles 80+ common tags including UNDEFINED type values (ExifVersion, ComponentsConfiguration, UserComment); MakerNote data is detected but not decoded (vendor-specific)
- Large file hashing may be slow in browsers without Web Workers (29 algorithms computed sequentially)
- PE signature matching only supports ep_only=true entries (non-EP signatures require full file scan)
- OLE2 parsing limited to SummaryInformation properties; stream content (e.g., Word text) not extracted
- APK icon extraction only works for STORED (uncompressed) PNG entries; DEFLATE entries are skipped
- APK binary XML parsing extracts string pool and element attributes but does not fully decode resource references
- "Open in Archiver" button only available when file was opened from VFS (not drag-dropped files)
- Disassembly covers common instruction subsets; rare/vector/FPU instructions may show as `db` bytes
- Disassembly annotations (imports/exports/strings) require PE or ELF format; other formats get plain disassembly
- String extraction from data sections uses a minimum length of 4 characters (ANSI or Unicode); shorter strings are not captured; results are deduplicated by value
- SNES LoROM/HiROM detection relies on checksum complement validation; corrupted ROMs may not be detected
- Genesis ROM detection requires "SEGA MEGA DRIVE" or "SEGA GENESIS" header string at offset 0x100
- VB6 P-code opcode set is partially reverse-engineered; some opcodes may decode as unknown
- Python .pyc marshal parsing is simplified; complex nested code objects may not fully resolve
- Geo map picker requires internet access for OpenStreetMap tiles
- MetaTrader EA (.ex4/.ex5) identification is extension-based only (proprietary format, no reliable magic bytes)
