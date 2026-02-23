# Archiver

## Purpose

Full-featured archive manager supporting 69+ archive formats. Browse, create, extract, and manage compressed archives with an Explorer-like interface. Features format conversion, volume splitting, recovery records, password protection, archive integrity testing, and a detailed archive info dialog with compression visualization.

## How It Works

Uses a pluggable format system (`IArchiveFormat`) where each archive format registers itself with parsing and building capabilities. Archives are loaded as byte arrays, parsed into entry lists, and displayed in a navigable file list with virtual folder support. The UI provides file operations via menus, toolbar, keyboard shortcuts, and context actions.

## Architecture

- **`index.html`** -- Menu bar (File/Actions/Tools/Help), toolbar, address bar, sortable file list table, multiple dialogs (password, new archive, convert format, archive info, properties, about), status bar
- **`controller.js`** -- IIFE with archive operations (open, save, add, delete, extract, test, convert), file list rendering with sorting and selection, address bar navigation, dialog management
- **`styles.css`** -- Explorer-like layout with toolbar, address bar, file list, status bar
- **`formats.js`** -- Archive format framework (`IArchiveFormat` base class, format registry)
- **Shared modules** -- `menu.js`, `dialog.js`
- **External dependency** -- JSZip (for multi-file extraction bundling and volume packaging)

## Features

### Supported Archive Formats (69+)
- **Compression**: ZIP, ZIPX, GZIP, BZIP2, XZ, ZStandard, LZMA, LZ, LZO, Compress (.Z)
- **Archives**: TAR, TAR.GZ, TAR.LZ, 7-Zip, RAR, LZH/LHA, ARJ, SQX, ACE, ARC, ZOO, HA, StuffIt/StuffItX, PAK, ALZ, PEA
- **System**: CPIO, CAB, ISO, WIM/ESD, RPM, DEB, AR/LIB, XAR, PKG, MSI, CHM
- **Java/Android**: JAR, WAR, EAR, APK
- **Office/Document**: DOCX, XLSX, PPTX, ODT, ODS, ODP, EPUB
- **Encoding**: Base64, UUEncode, Intel HEX
- **Recovery**: PAR, PAR2
- **Other**: MAR, SHAR, DMG, VHD, VHDX, VDI, VMDK, QCOW2, IMG

### Archive Operations
- **New Archive** -- Create empty archive with format selection and format-specific options
- **Open Archive** -- Load archive from SZ VFS with auto-format detection
- **Save / Save As** -- Write modified archive back to VFS
- **Import** -- Open archives from local filesystem via browser file picker
- **Export** -- Export archive to browser download
- **Add Files** -- Add files to archive from VFS (creates archive if none open)
- **Delete** -- Remove selected files/folders from archive
- **Extract All** -- Extract all files (single file direct export, multiple files bundled as ZIP)
- **Extract Selected** -- Extract only selected files
- **View** -- Open selected file in appropriate SZ app
- **Test** -- Verify archive integrity via CRC-32 checks (reports OK/Failed/Skipped counts)

### Password Protection
- Password prompt for encrypted archives on open
- Password creation with confirmation for new encrypted archives
- Supports AES-encrypted ZIP entries

### Volume Splitting
- Configurable volume size for split archives
- Volumes packaged as numbered parts (.001, .002, etc.)
- Bundle output with optional recovery record

### Recovery Records
- XOR-based parity recovery record generation
- Configurable recovery percentage
- Custom SZRV format header with CRC-32 verification

### Format Conversion
- Convert between any writable formats
- Preserves file data during conversion
- Format-specific options available during conversion

### File List UI
- Sortable columns: Name, Size, Packed, Type, Modified, CRC-32, Encrypted
- Click column headers to sort ascending/descending
- Virtual folder navigation (click folders to enter, address bar shows path)
- Up button and address bar for directory navigation
- Multi-selection with Ctrl+click and Shift+click
- Select All (Ctrl+A)
- Double-click to open files or enter folders
- Row highlighting on selection and hover
- File size formatting (B/KB/MB)
- Date formatting with locale support

### Archive Info Dialog
- Format name and host OS detection
- General stats: total files, total folders
- Size stats: total size, packed size, archive file size
- Compression ratio with 3D pie chart visualization (canvas-drawn)
- Encryption status indicator

### Properties Dialog
- File name, original size, packed size
- Compression ratio, modification date
- CRC-32 value, encryption status

### Status Bar
- Item count, total size, format name, selection count

### Keyboard Shortcuts
- Ctrl+N -- New archive
- Ctrl+O -- Open archive
- Ctrl+S -- Save archive
- Ctrl+E -- Extract all
- Insert -- Add files
- Delete -- Delete selected
- Enter -- View selected file
- Alt+Enter -- Properties of selected file
- Ctrl+A -- Select all
- F5 -- Refresh file list
- Escape -- Close dialogs

### Integration
- Menu bar with File, Actions, Tools, and Help menus
- Toolbar with common operations
- SZ OS file dialogs (ComDlg32.GetOpenFileName, GetSaveFileName, ExportFile)
- SZ OS kernel for VFS read/write (Kernel32.ReadAllBytes, WriteAllBytes)
- SZ OS message boxes for confirmations and errors
- Window title updates with dirty indicator (*)
- App launcher integration for file viewing

## User Stories

- [x] As a user, I want to open archive files so I can browse their contents
- [x] As a user, I want the archive format auto-detected so I don't have to specify it manually
- [x] As a user, I want to navigate folders inside the archive so I can find specific files
- [x] As a user, I want to sort files by name, size, or date so I can organize the view
- [x] As a user, I want to extract all files from an archive so I can access the contents
- [x] As a user, I want to extract only selected files so I can get just what I need
- [x] As a user, I want to create new archives so I can compress files together
- [x] As a user, I want to add files to an existing archive so I can update its contents
- [x] As a user, I want to delete files from an archive so I can remove unwanted entries
- [x] As a user, I want to test archive integrity so I can verify files aren't corrupted
- [x] As a user, I want password protection so I can secure sensitive archives
- [x] As a user, I want to enter a password when opening encrypted archives so I can access protected content
- [x] As a user, I want to convert between archive formats so I can change compression or compatibility
- [x] As a user, I want volume splitting so I can create multi-part archives for size-limited media
- [x] As a user, I want recovery records so I can repair damaged archives
- [x] As a user, I want to see archive info (compression ratio, file counts, sizes) so I can understand the archive
- [x] As a user, I want a compression ratio pie chart so I can visualize how well files are compressed
- [x] As a user, I want to view file properties (CRC, dates, encryption) so I can inspect individual entries
- [x] As a user, I want keyboard shortcuts so I can work efficiently without the mouse
- [x] As a user, I want multi-selection so I can operate on multiple files at once
- [x] As a user, I want a dirty indicator (*) in the title so I know if I have unsaved changes
