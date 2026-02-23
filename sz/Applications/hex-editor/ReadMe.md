# Hex Editor

A professional binary file editor for »SynthelicZ« that displays file contents in a traditional hex dump layout with offset, hex bytes, and ASCII columns, supporting full editing, search, virtual scrolling, struct template analysis, and configurable display with a ribbon UI.

## Product Requirements

### Purpose
Hex Editor provides a low-level binary file inspection and editing tool within the »SynthelicZ« desktop. It allows users to view and modify raw file bytes directly, which is essential for debugging, reverse engineering, data recovery, and examining file formats at the binary level. The struct template system enables visual analysis of binary file formats with colorized field overlays.

### Key Capabilities
- Traditional three-column hex dump display with offset addresses, hex byte values, and ASCII character representation
- Ribbon UI with Quick Access Toolbar, backstage file menu, and tabbed panels (Home, View, Templates)
- Virtual scrolling engine that renders only visible rows for efficient handling of large files
- Full byte editing in both hex and ASCII columns with insert and overwrite modes
- Selection, clipboard operations (cut/copy/paste as hex text), and multi-level undo/redo up to 500 levels
- Hex and ASCII search with match highlighting, next/previous navigation, and match count display
- Go-to-address navigation for jumping directly to specific byte offsets
- Auto-calculated bytes-per-row that adjusts to window width, plus manual options (8, 16, 32, 64)
- Struct template engine with 40 built-in format templates
- Struct visualization panel with collapsible tree view, pastel-colored field highlighting in hex view, and inline value editing
- Data inspector panel with multi-type interpretation at cursor, LE/BE toggle, inline editing, and color swatches
- Accordion UI with independently collapsible Data Inspector and Structure sections
- Multiple templates can be applied simultaneously at arbitrary offsets
- Ctrl+click rebasing: moves all applied templates to the clicked offset; applies selected template when none are active
- C/C++ header file import with support for structs, unions, arrays, and bitfields (including GUID, FILETIME, COLORREF types)
- C# struct file import with support for `[FieldOffset]` attributes, `fixed` arrays, and Guid/DateTime types
- 50+ primitive types including int24, int64, float16, GUID, FourCC, IPv4, timestamps, colors, BCD, wchar, binary/octal display, UTF-8
- Bitfield support with per-bit extraction and write-back
- Status bar showing file size, cursor offset, selection size, and editing mode

### Design Reference
Modeled after professional hex editors such as HxD, 010 Editor, and ImHex, featuring the familiar offset-hex-ASCII three-column layout with modified-byte highlighting and struct template overlays.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## Architecture

### File Structure
```
Applications/hex-editor/
  index.html              Entry point — ribbon UI, hex view, struct panel, dialogs
  controller.js           Main application logic — editing, rendering, template state
  styles.css              All styling — hex view, struct panel, dialogs
  struct-parser.js         C header and C# struct file parsers
  ReadMe.md               This file

Applications/shared/
  struct-engine.js         Template data model, type system, evaluation engine (shared)
  struct-templates.js      23 built-in format template definitions (shared)
```

### Key Modules
- **Ribbon UI**: Uses shared `ribbon.js`/`ribbon.css` components (same as Paint, Notepad, WordPad). Tabs: Home (clipboard, editing), View (BPR, panels), Templates (auto-detect, select, import).
- **Struct Engine** (`shared/struct-engine.js`): 50+ primitive types including integers (int8–int64, uint8–uint64, int24/uint24), floats (float16/32/64), binary display (bin8/16/32), octal display (oct8/16/32), timestamps (Unix32/64, DOS FAT, FILETIME, .NET ticks), colors (RGB24, RGBA32, BGR24, BGRA32, RGB565), special types (GUID, FourCC, IPv4, BCD, wchar, UTF-8), all with LE/BE variants. Types support optional `format` callbacks for human-readable display and `colorFormat` for inline swatches. Fields support arrays, nested structs, unions, explicit offsets, bitfields, char[N] and wchar[N] strings. Template registry with auto-detection via magic bytes. Exported on `SZ.StructEngine` namespace for sharing across apps.
- **Built-in Templates** (`shared/struct-templates.js`): 38 format templates — BMP, PNG, RIFF/WAV, JPEG, GIF, TIFF (LE/BE), ICO, CUR, ANI, PCX, TGA, WebP, FLAC, OGG, MKV/WebM, MPEG-PS, MP3 ID3v2, MIDI, PE/MZ, ELF, Java Class, Mach-O (32/64), ZIP, GZIP, RAR, 7z, TAR, PDF, PSD, SQLite, WASM, AVI, NES (iNES), Game Boy, N64, D64, SNES, Genesis/MD.
- **Struct Parser** (`struct-parser.js`): Parses C `typedef struct`/`union` and C# `struct` definitions from source text. Maps C types (DWORD, uint32_t, GUID, FILETIME, COLORREF, etc.) and C# types (int, byte, Guid, DateTime, etc.) to engine primitives.
- **Data Inspector**: BitBench-style panel showing all type interpretations at cursor offset, grouped by category (Integers, Floats, Binary, Characters, Date/Time, Colors, Special). LE/BE toggle, inline editing with binary/octal/hex prefix support, color swatches, UTF-8 decoding.

## User Stories

### File Operations
- [x] As a user, I can create a new empty buffer (Ctrl+N)
- [x] As a user, I can open a binary file using a file dialog (Ctrl+O)
- [x] As a user, I can save the current buffer to disk (Ctrl+S)
- [x] As a user, I can save the buffer with a new name using Save As
- [x] As a user, I can open a file passed via command line arguments
- [x] As a user, I can drag and drop a file onto the editor to open it
- [x] As a user, I can see the filename and dirty indicator in the window title bar
- [x] As a user, I can exit the application from the File backstage

### Ribbon UI
- [x] As a user, I can access commands via the ribbon with Home, View, and Templates tabs
- [x] As a user, I can use Quick Access Toolbar buttons for Save, Undo, and Redo
- [x] As a user, I can access file operations via the File backstage menu
- [x] As a user, I can use keyboard shortcuts as before (Ctrl+N/O/S/Z/Y/F/G/A/X/C/V)

### Hex Display
- [x] As a user, I can see file contents displayed with offset, hex bytes, and ASCII columns
- [x] As a user, I can see the offset column showing the byte address in hexadecimal
- [x] As a user, I can see each byte displayed as a two-digit uppercase hex value
- [x] As a user, I can see the ASCII representation of each byte (dot for non-printable characters)
- [x] As a user, I can see a header row labeling the byte positions within each row
- [x] As a user, I can see modified bytes highlighted in a distinct color
- [x] As a user, I can see the cursor position highlighted in both hex and ASCII columns
- [x] As a user, I can see an empty-state message when no file is loaded

### Virtual Scrolling
- [x] As a user, I can view large files efficiently through virtual scrolling that only renders visible rows
- [x] As a user, I can scroll smoothly through the hex view
- [x] As a user, I can see the display update automatically when the viewport is resized

### Bytes Per Row
- [x] As a user, I can set bytes-per-row to Auto mode which adjusts to window width
- [x] As a user, I can manually select 8, 16, 32, or 64 bytes per row from the View tab
- [x] As a user, I can see the current setting indicated by radio buttons in the ribbon
- [x] As a user, I can see the header update to match the selected bytes-per-row setting

### Cursor Navigation
- [x] As a user, I can move the cursor with arrow keys (left, right, up, down)
- [x] As a user, I can jump a page of rows with PageUp and PageDown
- [x] As a user, I can jump to the start of the current row with Home
- [x] As a user, I can jump to the end of the current row with End
- [x] As a user, I can jump to the beginning of the file with Ctrl+Home
- [x] As a user, I can jump to the end of the file with Ctrl+End
- [x] As a user, I can see the view automatically scroll to keep the cursor visible

### Editing - Hex Column
- [x] As a user, I can type hex digits (0-9, a-f) to edit bytes in the hex column
- [x] As a user, I can edit the high nibble first, then the low nibble, before advancing
- [x] As a user, I can see modified bytes tracked and highlighted
- [x] As a user, I can insert new bytes when in Insert mode

### Editing - ASCII Column
- [x] As a user, I can switch to the ASCII column with Tab
- [x] As a user, I can type printable ASCII characters to edit bytes in the ASCII column
- [x] As a user, I can insert new bytes in the ASCII column when in Insert mode

### Insert/Overwrite Mode
- [x] As a user, I can toggle between Insert and Overwrite mode with the Insert key
- [x] As a user, I can see the current mode (INS/OVR) displayed in the status bar
- [x] As a user, I can insert new bytes at the cursor position in Insert mode
- [x] As a user, I can overwrite existing bytes at the cursor position in Overwrite mode

### Selection
- [x] As a user, I can select a range of bytes by Shift+clicking
- [x] As a user, I can extend the selection using Shift+arrow keys
- [x] As a user, I can select bytes by clicking and dragging
- [x] As a user, I can select all bytes with Ctrl+A
- [x] As a user, I can see selected bytes highlighted in both hex and ASCII columns
- [x] As a user, I can see the number of selected bytes in the status bar

### Delete Operations
- [x] As a user, I can delete the byte at the cursor position with Delete
- [x] As a user, I can delete the byte before the cursor with Backspace
- [x] As a user, I can delete a selected range of bytes with Delete or Backspace

### Clipboard
- [x] As a user, I can copy the selected bytes as hex text (Ctrl+C)
- [x] As a user, I can cut the selected bytes (Ctrl+X)
- [x] As a user, I can paste hex text or plain text into the buffer (Ctrl+V)
- [x] As a user, I can see pasted hex data auto-detected from space-separated hex byte strings

### Undo/Redo
- [x] As a user, I can undo changes with Ctrl+Z (up to 500 levels)
- [x] As a user, I can redo changes with Ctrl+Y
- [x] As a user, I can undo/redo byte modifications, insertions, and deletions

### Go to Address
- [x] As a user, I can open a Go to Address dialog with Ctrl+G
- [x] As a user, I can enter a hex address to jump to
- [x] As a user, I can see the current offset pre-filled in the dialog
- [x] As a user, I can press Enter to jump or Escape to cancel

### Find
- [x] As a user, I can open a Find dialog with Ctrl+F
- [x] As a user, I can search for hex byte patterns (e.g., "FF A0 48")
- [x] As a user, I can search for ASCII text strings
- [x] As a user, I can find the next match with Find Next or F3
- [x] As a user, I can find the previous match with Find Prev or Shift+F3
- [x] As a user, I can see the number of matches found
- [x] As a user, I can see matched bytes highlighted in the display

### Status Bar
- [x] As a user, I can see the file size in bytes
- [x] As a user, I can see the current cursor offset in both hex and decimal
- [x] As a user, I can see the number of selected bytes when a selection exists
- [x] As a user, I can see the current editing mode (INS/OVR)

### Struct Templates
- [x] As a user, I can see the file format auto-detected and its template applied when loading a file
- [x] As a user, I can auto-detect via magic bytes (primary) or file extension (fallback)
- [x] As a user, I can select a template from a dropdown and apply it at the cursor position
- [x] As a user, I can see struct fields as a collapsible tree in the Struct Panel sidebar
- [x] As a user, I can see hex bytes colorized with pastel colors matching struct field entries
- [x] As a user, I can click a struct field to select and scroll to its bytes in the hex view
- [x] As a user, I can double-click a field value to edit it inline (changes reflect in hex view)
- [x] As a user, I can apply multiple templates simultaneously at different offsets
- [x] As a user, I can Ctrl+click a byte to rebase all applied templates to that offset, or apply the selected template when none are active
- [x] As a user, I can remove individual applied templates via the × button
- [x] As a user, I can clear all applied templates at once
- [x] As a user, I can toggle the Struct Panel on/off from the View tab

### Struct Import
- [x] As a user, I can import C/C++ header files (.h) to create struct templates
- [x] As a user, I can import C# struct files (.cs) to create struct templates
- [x] As a user, I can import structs with nested structs and unions
- [x] As a user, I can import C unions where all fields share the same offset
- [x] As a user, I can import C# structs with `[FieldOffset]` attributes for explicit layout
- [x] As a user, I can import C bitfields (e.g., `uint8_t flags : 4`)
- [x] As a user, I can import C# `fixed` arrays (e.g., `fixed byte Data[16]`)
- [x] As a user, I can choose endianness when importing multiple structs

### Data Inspector
- [x] As a user, I can see a Data Inspector panel showing all type interpretations at the cursor offset
- [x] As a user, I can see values grouped by category (Integers, Floats, Characters, Date/Time, Colors, Special)
- [x] As a user, I can toggle between Little Endian and Big Endian interpretation via a dropdown
- [x] As a user, I can see types that don't fit at the cursor shown as N/A
- [x] As a user, I can see color swatches inline for color type values (RGB, RGBA, RGB565)
- [x] As a user, I can click a color swatch to launch the Color Picker app for precise color editing
- [x] As a user, I can double-click a value in the Data Inspector to edit it inline with multi-format input parsing
- [x] As a user, I can see the inspector panel updates in real-time as I move the cursor
- [x] As a user, I can expand/collapse the Data Inspector and Structure accordion sections independently

### Built-in Templates (40 formats)
- [x] BMP image header (signature, file size, DIB header with dimensions, BPP, compression)
- [x] PNG image header (signature, IHDR chunk with dimensions, color type, interlace)
- [x] RIFF/WAV audio header (chunk ID, format, audio format, channels, sample rate)
- [x] JPEG image header (SOI, APP0 marker, JFIF identifier, density)
- [x] GIF image header (signature, version, dimensions, packed byte)
- [x] TIFF image header, both LE (II) and BE (MM) byte orders
- [x] ICO icon file (type, count, first entry with dimensions, planes, bit count, offset)
- [x] CUR cursor file (type, count, first entry with hotspot, size, offset)
- [x] ANI animated cursor (RIFF/ACON container, anih chunk with frames, display rate)
- [x] PCX image header (manufacturer, version, encoding, BPP, dimensions, DPI, planes)
- [x] TGA image header (color map, image type, dimensions, pixel depth) — extension-only detection
- [x] WebP image (RIFF/WEBP container, first chunk)
- [x] FLAC audio (signature, STREAMINFO block with block sizes, sample rate, MD5)
- [x] OGG container (capture pattern, header type, granule position, serial, CRC)
- [x] MKV/WebM (EBML container header with version and format info)
- [x] AVI video header (RIFF chunk, hdrl list, avih chunk with frame rate and dimensions)
- [x] MPEG Program Stream (pack start code, SCR, mux rate)
- [x] MP3 ID3v2 tag header (signature, version, flags, syncsafe size)
- [x] MIDI (MThd chunk, format type, track count, division)
- [x] PE/MZ DOS executable header (all e_ fields including e_lfanew)
- [x] ELF executable header (magic, class, data encoding, OS/ABI, type, machine)
- [x] Java Class file (magic, version, constant pool count)
- [x] Mach-O 32-bit and 64-bit (magic, CPU type, file type, load commands)
- [x] ZIP local file header (signature, version, compression, CRC32, sizes)
- [x] GZIP header (magic, method, flags, mod time, OS)
- [x] RAR archive (signature, version, header CRC, flags)
- [x] 7-Zip archive (signature, version, start header CRC, next header)
- [x] TAR archive / USTAR (filename, mode, UID/GID, size, USTAR magic)
- [x] PDF document (%PDF magic, version)
- [x] PSD / PSB (signature, version, channels, dimensions, color mode)
- [x] SQLite database (header string, page size, versions, database size)
- [x] WebAssembly (magic, version)
- [x] NES ROM iNES header (magic, PRG/CHR ROM sizes, flags)
- [x] Game Boy ROM header (entry point, title, cartridge type, ROM/RAM size, checksum) — extension-only, applies at 0x100
- [x] N64 ROM header (PI register, clock rate, CRC, image name, country code)
- [x] D64 C64 disk image BAM (directory track, DOS version, disk name, ID) — extension-only, applies at 0x16500
- [x] SNES ROM internal header (game title, map mode, ROM/RAM size, country, checksum) — extension-only, applies at 0x7FC0
- [x] Genesis/Mega Drive ROM header (console name, game names, serial, ROM/RAM addresses) — extension-only, applies at 0x100

### Future Enhancements
- [x] ~~As a user, I want a data inspector panel showing the value at the cursor as various types (int8, int16, int32, float, etc.)~~ — Implemented
- [ ] As a user, I want find and replace functionality
- [ ] As a user, I want to fill a selected range with a specific byte value
- [ ] As a user, I want to see a minimap or scrollbar indicator showing modified regions
- [ ] As a user, I want to compare two files side by side with differences highlighted
- [ ] As a user, I want to export selected bytes or the entire file as a C array, Base64, or other format
- [ ] As a user, I want bookmarks/annotations at specific offsets
- [ ] As a user, I want configurable font size for the hex display
