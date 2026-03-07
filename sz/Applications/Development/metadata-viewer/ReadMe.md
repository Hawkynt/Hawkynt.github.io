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

## User Stories

### File Loading
- [x] As a user, I can drag and drop any file onto the viewer so that I can quickly analyze it
- [x] As a user, I can open files from the VFS with data URL decoding so that I can inspect virtual file system files
- [x] As a user, I can have the file type auto-identified via magic bytes (100+ formats) so that I do not need to specify the format manually
- [x] As a user, I can see dual-nature files (e.g., DOCX = ZIP + Word) display metadata from both formats so that I get complete information
- [x] As a user, I can use keyboard shortcuts (Ctrl+O to open, Ctrl+I to import, Ctrl+S to save) so that I can work efficiently

### File Identification
- [x] As a user, I can have files identified by magic byte signatures so that identification does not rely on file extensions
- [x] As a user, I can have ISO BMFF brands detected (HEIC, AVIF, AV1, 3GPP, M4V, QuickTime, Canon RAW) so that modern media formats are recognized
- [x] As a user, I can have RIFF sub-types detected (WAV, AVI, WebP, ANI, MIDI, CorelDRAW) so that container formats are distinguished
- [x] As a user, I can have shebang scripts detected (Python, Bash, Node.js, Perl, Ruby, PHP) so that script files are properly identified
- [x] As a user, I can have text format heuristics applied (PEM, iCalendar, vCard, CSS, YAML, INI) so that text-based formats are recognized
- [x] As a user, I can have ZIP containers analyzed (OOXML, JAR, APK, EPUB, ODF, browser extensions) so that ZIP-based formats are distinguished

### Metadata Parsing
- [x] As a user, I can see format-specific metadata organized in categorized tabs so that I can browse metadata by topic
- [x] As a user, I can see category tab icons (Unicode emoji indicators) so that I can quickly identify each category
- [x] As a user, I can see EXIF data extracted (IFD0, SubIFD, GPS, Thumbnail IFD) with 80+ tags and human-readable values so that I can inspect photo details
- [x] As a user, I can see IPTC metadata parsed for JPEG (APP13/Photoshop 3.0/8BIM resource blocks) so that I can inspect press/editorial metadata
- [x] As a user, I can see GPS coordinates displayed in DMS format (e.g., 48deg 51' 24.00" N) so that locations are human-readable
- [x] As a user, I can see ID3v1/v2 tags parsed with album art extraction (50+ frame types) so that I can inspect audio metadata
- [x] As a user, I can see MP4/M4A iTunes metadata parsed with cover art extraction so that I can inspect video/audio metadata
- [x] As a user, I can see OOXML metadata for docx/xlsx/pptx files so that I can inspect Office document properties
- [x] As a user, I can see Legacy Office (OLE2) metadata for doc/xls/ppt files so that I can inspect older Office documents
- [x] As a user, I can see JAR manifest, class listing, and packages so that I can inspect Java archives

### Executable Analysis
- [x] As a user, I can see PE deep analysis (sections, imports, exports, .NET CLR) so that I can inspect Windows executables
- [x] As a user, I can see PE import expansion with individual function names per DLL in expandable/collapsible rows so that I can inspect API usage
- [x] As a user, I can see PE packer/protector/compiler/framework detection via section names, strings, and imports so that I can identify the build toolchain
- [x] As a user, I can see PE entry-point signature matching (4,400+ ExeInfo ASL signatures) so that I can identify specific packer/compiler versions
- [x] As a user, I can see PE resource extraction (RT_ICON/RT_BITMAP/RT_VERSION/RT_MANIFEST) with ICO reconstruction so that I can view embedded resources
- [x] As a user, I can see PE embedded strings extracted (ANSI/UTF-16/Unicode) with deduplication and real-time search filter so that I can find interesting strings
- [x] As a user, I can see ELF deep analysis (sections, program headers, linked libraries, compiler detection) so that I can inspect Linux executables
- [x] As a user, I can see Mach-O deep analysis (segments, linked libraries, build version, compiler detection) so that I can inspect macOS/iOS executables
- [x] As a user, I can see Microsoft PDB detection and header parsing so that I can identify debug symbol files
- [x] As a user, I can see MetaTrader EA detection (.ex4/.ex5) so that I can identify trading scripts
- [x] As a user, I can see Android DEX full parsing (string/type/method/field tables, class definitions) so that I can inspect Android apps
- [x] As a user, I can see Android OAT/VDEX/ART header parsing so that I can inspect Android runtime files
- [x] As a user, I can see APK deep parsing (package name, permissions, SDK versions, DEX/native analysis, icon extraction) so that I can inspect Android packages

### .NET Assembly Analysis
- [x] As a user, I can see a .NET Assembly tree view with namespace > type > member hierarchy and Visual Studio-style SVG icons so that I can browse the type system
- [x] As a user, I can click a method in the assembly tree to navigate to its IL body so that I can inspect individual methods
- [x] As a user, I can see .NET blob signature decoding (ECMA-335 method signatures to C#-like type names, generics) so that I can read method signatures
- [x] As a user, I can see .NET StandAloneSig table and LOCAL_SIG decoding for typed local variable declarations so that I can see local types
- [x] As a user, I can see .NET exception handling clause parsing (ECMA-335 small/fat format, catch/finally/fault/filter) so that I can see error handling
- [x] As a user, I can see .NET #US (User Strings) heap resolved for ldstr instructions so that I can see embedded string literals

### Disassembly
- [x] As a user, I can see entry-point disassembly for executables and retro ROMs with pseudo-C comments so that I can understand the code
- [x] As a user, I can click jump/call targets in the disassembly to navigate to those addresses so that I can follow code flow
- [x] As a user, I can use the navigation toolbar (back/forward/goto/address bar) so that I can navigate through disassembled code
- [x] As a user, I can scroll near the bottom to auto-load more instructions seamlessly so that I can explore beyond the initial view
- [x] As a user, I can see disassembly annotations (resolved DLL!function names, extracted strings, export names) so that I can understand API calls and data references
- [x] As a user, I can see label lines at jump/call targets (loc_XXXXXXXX:) so that branch targets are readable
- [x] As a user, I can see a cross-references panel listing imports, strings, calls, and exports so that I can understand code dependencies
- [x] As a user, I can see multi-panel disassembly for formats with multiple code types (.NET = x86 + MSIL, VB6 = x86 + P-Code) so that each code type has independent navigation
- [x] As a user, I can switch between view modes (Assembly/Pseudo-C for x86, IL/C#/VB/C# simplified for MSIL, JIL/Java/Kotlin for Java) so that I can choose my preferred output style
- [x] As a user, I can see 16 architectures disassembled (x86/x64, ARM/ARM64, Java, MSIL, PowerPC, Dalvik, 6502/65C816, Z80, 68000, Python, VB P-code, Dart) so that any executable format is supported

### MSIL Decompiler
- [x] As a user, I can see MSIL decompiled to structured C# with if/else/while/do-while/for/switch patterns so that I can read .NET code as high-level source
- [x] As a user, I can see try/catch/finally blocks reconstructed from EH clause parsing so that exception handling is readable
- [x] As a user, I can see C# 2.0 patterns recognized (using/foreach/lock/compound assignments/ternary) so that common idioms appear naturally
- [x] As a user, I can see modern C# patterns (async/await, string interpolation, null-conditional/coalescing, pattern matching) so that modern code is readable
- [x] As a user, I can see VB.NET structured output (While/For Each/Try/Using/SyncLock) so that I can read code in VB syntax
- [x] As a user, I can see Java decompiler output in low-level Java, high-level Java, and Kotlin syntax so that I can choose my preferred JVM language

### Retro ROM Analysis
- [x] As a user, I can see retro ROM headers parsed (NES iNES, Game Boy, Sega Master System, Sega Genesis, SNES LoROM/HiROM, C64 .prg, Amiga Hunk) so that I can inspect classic game ROMs
- [x] As a user, I can see MOS 6502 disassembly with 65C816 SNES extension mode so that I can inspect NES/C64/SNES code
- [x] As a user, I can see Z80 disassembly with Game Boy restricted mode so that I can inspect Game Boy/Master System code
- [x] As a user, I can see Motorola 68000 disassembly with full effective address decoding so that I can inspect Amiga/Genesis code

### Hash and Checksum Computation
- [x] As a user, I can see 29 hash/checksum algorithms computed (grouped by Cryptographic, Non-Cryptographic, Checksums) so that I can verify file integrity
- [x] As a user, I can see large files processed in 512KB chunks via async scheduling so that the UI remains responsive
- [x] As a user, I can click any hash value to copy it to the clipboard so that I can use it elsewhere

### Metadata Editing
- [x] As a user, I can edit MP3 ID3 tags, PNG text chunks, JPEG EXIF fields, MP4 iTunes atoms, and OOXML properties inline so that I can modify metadata without external tools
- [x] As a user, I can use rich edit controls (text, number, date picker, select dropdown, image replace/remove, geo coordinate picker, compass angle) so that each field type has an appropriate editor
- [x] As a user, I can use a GeoSetter-style GPS editor with OSM map, geocoding, compass widget, and IPTC location fields so that I can precisely set photo locations
- [x] As a user, I can rebuild EXIF IFDs with add/remove/modify tags and RATIONAL type support so that I can manipulate EXIF at a low level
- [x] As a user, I can write IPTC APP13 data (City, Sub-Location, State, Country, Country Code) including from scratch so that I can add editorial location metadata
- [x] As a user, I can write GPS coordinates to EXIF via the geo picker with forward geocoding search so that I can geolocate photos
- [x] As a user, I can add new EXIF tags via an "Add EXIF Tag" dialog with EXIF and GPS tag groups so that I can augment existing metadata
- [x] As a user, I can see genre autocomplete with 192 standard ID3 genres so that I can quickly select music genres
- [x] As a user, I can reconstruct and save modified files so that my edits are persisted

### Preview Panels
- [x] As a user, I can see embedded images (thumbnails, EXIF images, album art, APK icons) so that I can preview visual content
- [x] As a user, I can see a color-coded hex preview with byte regions mapped to parsed metadata fields so that I can understand the binary structure
- [x] As a user, I can see a text preview (first 4KB with non-printable markers and region coloring) so that I can inspect text content
- [x] As a user, I can see a Unicode preview (BOM-aware with code point annotations) so that I can inspect Unicode encoding
- [x] As a user, I can see a waveform preview (PCM for WAV, byte-amplitude for compressed audio) so that I can visualize audio data
- [x] As a user, I can resize the splitter between metadata and preview panels so that I can allocate space as needed
- [x] As a user, I can see accordion preview sections auto-expand based on file type so that relevant previews appear automatically

### Statistics and Analysis
- [x] As a user, I can see Shannon entropy and encoding detection so that I can assess file randomness
- [x] As a user, I can see enhanced statistics (chi-square, serial correlation, Monte Carlo Pi, byte frequency analysis) so that I can perform detailed analysis

### Integration
- [x] As a user, I can copy all metadata to clipboard so that I can paste it elsewhere
- [x] As a user, I can click "Open in Archiver" for archive file types (24 formats) so that I can browse archive contents
- [x] As a user, I can see Explorer Properties dialog integration so that the Properties dialog reuses the metadata parsers

### Planned Features
- [ ] As a user, I can see zTXt (compressed text) PNG chunks so that compressed PNG metadata is readable
- [ ] As a user, I can edit MKV/WebM Matroska tags so that video metadata is writable
- [ ] As a user, I can analyze files in batch so that I can process multiple files at once
- [ ] As a user, I can see APK icons from DEFLATE-compressed entries so that all APK icons are extracted
- [ ] As a user, I can replace or remove ID3 APIC (album art) via image edit controls so that album art is fully editable
- [ ] As a user, I can replace or remove MP4 cover art via image edit controls so that video cover art is fully editable
- [ ] As a user, I can regenerate EXIF thumbnails from the main image so that thumbnails stay in sync after editing

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
