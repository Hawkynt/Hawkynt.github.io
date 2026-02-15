# Metadata Viewer

File analysis and metadata editor for the SZ desktop environment.

## Purpose

Drop any file onto the Metadata Viewer to identify its type via magic bytes (not file extensions), view format-specific metadata in a categorized UI, see embedded images (EXIF thumbnails, album art), compute cryptographic hashes, and edit certain metadata fields.

## How It Works

1. **File Identification** -- A magic byte table (100+ signatures) identifies the file type in two passes: direct signature matching (magic bytes, RIFF fourcc, ISO BMFF ftyp brands), then heuristic detection for text-based formats, ZIP containers (OOXML, JAR, APK, EPUB, ODF), shebangs, PEM certificates, and more.
2. **Format Parsing** -- Format-specific parsers extract metadata into categorized field sets. All parsing is pure `DataView`/`Uint8Array` operations with no external libraries.
3. **Hash Computation** -- 29 hash/checksum algorithms grouped into Cryptographic (MD5, SHA-1/224/256/384/512, SHA-512/256, SHA3-256/384/512, BLAKE2b/2s, BLAKE3, RIPEMD-160, Whirlpool, Tiger, SM3, Streebog-256), Non-Cryptographic (xxHash32, xxHash3, MurmurHash3), and Checksums (CRC-16/32/64, Adler-32, Fletcher-32, BSD, Sum-8, XOR-8) are computed using the Cipher project's `AlgorithmFramework`. Large files are processed in 512KB chunks via `setTimeout` to avoid blocking the UI.
4. **Metadata Editing** -- Writable formats (MP3 ID3 tags, PNG text chunks, JPEG EXIF fields, MP4 iTunes atoms, Office document properties) support inline field editing with file reconstruction on save.
5. **PE Detection** -- Executable analysis includes packer/protector/compiler/framework detection via section names, string scanning, import analysis, and a 4,400+ entry signature database converted from ExeInfo ASL's userdb.txt format.

## Supported Formats

| Category | Formats |
|----------|---------|
| Image | JPEG (EXIF/JFIF/GPS), PNG, GIF, BMP, TIFF, WebP, ICO, CUR, PSD, JPEG 2000, JPEG XL, JPEG XR, OpenEXR, GIMP XCF, WMF, FLIF, BPG, EPS, HEIC, AVIF |
| Audio | MP3 (ID3v1/ID3v2/MPEG frame), FLAC, OGG Vorbis, WAV, AIFF, MIDI, DSF, DFF, APE, AAC-ADTS, M4A |
| Video | MP4/M4V (ISO BMFF), MKV/WebM (EBML), AVI, ASF/WMV/WMA, FLV, MPEG-PS, MPEG-TS, MPEG Video, AV1, 3GPP, QuickTime |
| Document | PDF, RTF, DjVu, CHM, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), OpenDocument (ODF), EPUB, Legacy Office (.doc/.xls/.ppt via OLE2) |
| Executable | PE (.exe/.dll), ELF, Mach-O, Java .class, Android DEX, WebAssembly, Lua bytecode, Script files (shebang detection) |
| Archive | ZIP, RAR (v1.5/v5), 7Z, GZIP, TAR, XZ, LZ4, LZIP, Zstandard, BZip2, ARJ, Microsoft Cabinet, XAR, JAR, APK (deep), CRX, DEB, RPM |
| Data | SQLite, MDB (Access), HDF5, XML, JSON, HTML, SVG, CSS, YAML, INI, iCalendar, vCard, PEM certificates, PGP/GPG, ISO 9660, LNK, VHD/VHDX, NES ROM |
| Font | TTF, OTF, WOFF, WOFF2 |

## Architecture

```
pe-signatures.js -- SZ.PESignatures: 4,400+ PE packer/compiler/protector signatures (ExeInfo ASL format)
parsers.js       -- SZ.MetadataParsers: magic byte table, identify(), parse(), format parsers
editors.js       -- SZ.MetadataEditors: isEditable(), rebuildFile(), CRC32, ID3/PNG/EXIF/MP4/OOXML writers
controller.js    -- App logic: state, UI, file loading, drag-drop, hash computation, editing
styles.css       -- SZ theme-aware styling
index.html       -- HTML structure + Cipher script tags
```

### Parsers as Shared Library

`parsers.js` exports `SZ.MetadataParsers` on `window.SZ`. The Explorer app loads it via `<script src="../metadata-viewer/parsers.js">` to power its Properties dialog, with no code duplication.

### PE Signature Database

`pe-signatures.js` exports `SZ.PESignatures` -- an array of 4,400+ entry-point byte signatures converted from ExeInfo ASL's `userdb.txt` format. The PE parser matches these against the entry point bytes of executables to identify packers, protectors, compilers, and frameworks. The `_convert_userdb.js` script converts the raw userdb.txt to compact JS format.

### Cipher Integration

Hash/checksum algorithms are loaded from the Cipher project via `<script>` tags. The `AlgorithmFramework.Find(name)` API provides `CreateInstance()` with the `Feed()/Result()` pattern for streaming computation.

## Editing Support

| Format | Editable Fields | Strategy |
|--------|----------------|----------|
| MP3 (ID3v2) | Title, Artist, Album, Year, Genre, Track, Comment, Composer, Album Artist, Disc, BPM, Copyright, Publisher, and 30+ more frame types | Rebuild entire ID3v2 tag; genre autocomplete with 192 standard genres |
| MP3 (ID3v1) | Title, Artist, Album, Year, Comment | Overwrite fixed-offset fields |
| PNG (tEXt/iTXt) | All text chunks | Walk chunks, replace/insert, recalculate CRC32 |
| JPEG (EXIF) | Make, Model, Software, Artist, Copyright | Modify IFD entries in TIFF data, rebuild APP1 |
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
- **Status Bar**: File type, size, entropy, modification count

## Running

Open `index.html` in a browser, or launch from the SZ desktop Start Menu under "Development".

## Features

- [x] Magic byte file identification (100+ formats)
- [x] Format-specific metadata parsing
- [x] EXIF data extraction (IFD0, SubIFD, GPS, thumbnail)
- [x] ID3v1/v2 tag parsing with album art extraction (50+ frame types)
- [x] Genre autocomplete with 192 standard ID3 genres
- [x] PE deep analysis (sections, imports, exports, .NET CLR)
- [x] PE packer/protector/compiler/framework detection (section names, strings, imports)
- [x] PE entry-point signature matching (4,400+ ExeInfo ASL signatures)
- [x] ELF deep analysis (sections, program headers, linked libraries, compiler detection)
- [x] Mach-O deep analysis (segments, linked libraries, build version, compiler detection)
- [x] OOXML detection and Office document metadata parsing (docx/xlsx/pptx)
- [x] Legacy Office (OLE2) detection and metadata parsing (doc/xls/ppt)
- [x] Dual-nature file detection (ZIP + document/archive metadata merged)
- [x] JAR file identification and parsing (manifest, class listing, packages)
- [x] Hash/checksum computation (29 algorithms via Cipher project, grouped by category)
- [x] Async chunked hashing for large files
- [x] Inline metadata editing (MP3 ID3, PNG text chunks, JPEG EXIF, MP4 iTunes, OOXML properties)
- [x] MP4/M4A iTunes metadata parsing and cover art extraction
- [x] File reconstruction and save
- [x] Embedded image preview with save
- [x] Color-coded hex preview with byte regions mapped to parsed metadata fields
- [x] Text preview (first 4KB with non-printable markers and region coloring)
- [x] Unicode preview (BOM-aware with code point annotations)
- [x] Waveform preview (PCM for WAV, byte-amplitude for compressed audio)
- [x] Resizable splitter between metadata and preview panels
- [x] Accordion preview panel with smart auto-expansion by file type
- [x] Shannon entropy and encoding detection
- [x] Drag-and-drop file loading
- [x] VFS file open/save (with data URL decoding)
- [x] Click-to-copy hash values
- [x] Copy All Metadata to clipboard
- [x] Keyboard shortcuts (Ctrl+O, Ctrl+I, Ctrl+S)
- [x] Explorer Properties dialog integration
- [x] ISO BMFF brand detection (HEIC, AVIF, AV1, 3GPP, M4V, QuickTime, Canon RAW)
- [x] RIFF sub-type detection (WAV, AVI, WebP, ANI, MIDI, CorelDRAW)
- [x] Shebang script detection (Python, Bash, Node.js, Perl, Ruby, PHP)
- [x] Text format heuristics (PEM, iCalendar, vCard, CSS, YAML, INI)
- [x] ZIP container analysis (OOXML, JAR, APK, EPUB, ODF, browser extensions)
- [x] APK deep parsing (package name, permissions, SDK versions, DEX/native analysis, icon extraction)
- [x] "Open in Archiver" button for archive file types (24 archive formats supported)

## Planned Features

- [ ] IPTC metadata parsing for JPEG
- [ ] zTXt (compressed text) PNG chunk support
- [ ] MKV/WebM Matroska tag editing
- [ ] Batch file analysis
- [ ] Java bytecode disassembly (JAR class files)
- [ ] DEFLATE decompression for APK icon extraction from compressed entries

## Known Limitations

- JPEG EXIF editing limited to ASCII-type IFD0 tags (Make, Model, Software, Artist, Copyright)
- OOXML editing requires core.xml to be stored uncompressed (STORED method) in the ZIP container
- MKV/WebM metadata editing not yet supported (read-only)
- Hash computation requires the Cipher project scripts to be loadable
- EXIF parsing handles common tags; some proprietary MakerNote data is skipped
- Large file hashing may be slow in browsers without Web Workers (29 algorithms computed sequentially)
- PE signature matching only supports ep_only=true entries (non-EP signatures require full file scan)
- OLE2 parsing limited to SummaryInformation properties; stream content (e.g., Word text) not extracted
- APK icon extraction only works for STORED (uncompressed) PNG entries; DEFLATE entries are skipped
- APK binary XML parsing extracts string pool and element attributes but does not fully decode resource references
- "Open in Archiver" button only available when file was opened from VFS (not drag-dropped files)
