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

### Archive Operations
- [x] As a user, I can create a new archive with format selection and format-specific options so that I can compress files from scratch
- [x] As a user, I can open an archive from the VFS with auto-format detection so that I do not have to specify the format manually
- [x] As a user, I can save or save-as a modified archive back to the VFS so that my changes are persisted
- [x] As a user, I can import archives from my local filesystem via a browser file picker so that I can work with files outside the VFS
- [x] As a user, I can export archives to a browser download so that I can save them to my local machine
- [x] As a user, I can add files from the VFS to an archive (creating one if needed) so that I can build archives from existing files
- [x] As a user, I can delete selected files and folders from an archive so that I can remove unwanted entries
- [x] As a user, I can extract all files from an archive so that I can access the full contents
- [x] As a user, I can extract only selected files so that I can get just what I need
- [x] As a user, I can view a selected file by opening it in the appropriate SZ app so that I can preview archive contents
- [x] As a user, I can test archive integrity via CRC-32 checks (reports OK/Failed/Skipped counts) so that I can verify files are not corrupted

### Format Support
- [x] As a user, I can work with 69+ archive formats across compression, system, Java/Android, Office, encoding, and recovery categories so that nearly any archive type is supported
- [x] As a user, I can have the archive format auto-detected so that I do not need to know the format in advance
- [x] As a user, I can convert between any writable formats while preserving file data so that I can change compression or compatibility

### Password Protection
- [x] As a user, I can enter a password when opening encrypted archives so that I can access protected content
- [x] As a user, I can create password-protected archives with password confirmation so that I can secure sensitive files
- [x] As a user, I can encrypt ZIP entries with AES so that my data is strongly protected

### Volume Splitting
- [x] As a user, I can configure a volume size for split archives so that I can create multi-part archives for size-limited media
- [x] As a user, I can see volumes packaged as numbered parts (.001, .002, etc.) so that the split output is clearly organized

### Recovery Records
- [x] As a user, I can generate XOR-based parity recovery records with configurable recovery percentage so that I can repair damaged archives
- [x] As a user, I can see recovery records use a custom SZRV format with CRC-32 verification so that data integrity is assured

### File List Navigation
- [x] As a user, I can navigate virtual folders inside the archive by clicking folders and using the address bar so that I can find specific files
- [x] As a user, I can sort files by clicking column headers (Name, Size, Packed, Type, Modified, CRC-32, Encrypted) so that I can organize the view
- [x] As a user, I can select multiple files with Ctrl+click, Shift+click, and Ctrl+A so that I can operate on multiple files at once
- [x] As a user, I can double-click files to open them or enter folders so that navigation is intuitive
- [x] As a user, I can see file sizes formatted as B/KB/MB and dates with locale support so that the display is human-readable

### Archive Info Dialog
- [x] As a user, I can see format name, host OS, total files, total folders, sizes, and compression ratio so that I understand the archive structure
- [x] As a user, I can see a 3D pie chart visualization of the compression ratio so that I can visualize compression effectiveness

### Properties Dialog
- [x] As a user, I can view file properties (name, sizes, compression ratio, date, CRC-32, encryption status) so that I can inspect individual entries

### Keyboard Shortcuts
- [x] As a user, I can use Ctrl+N/O/S for new/open/save, Ctrl+E for extract all, Insert to add files, Delete to delete, and F5 to refresh so that I can work efficiently without the mouse
- [x] As a user, I can use Enter to view a file, Alt+Enter for properties, and Escape to close dialogs so that common actions are quick

### User Interface
- [x] As a user, I can see a menu bar with File, Actions, Tools, and Help menus so that I can access all operations
- [x] As a user, I can use a toolbar with common operations so that frequently used actions are one click away
- [x] As a user, I can see the window title update with a dirty indicator (*) so that I know if I have unsaved changes
- [x] As a user, I can see item count, total size, format name, and selection count in the status bar so that I have context at a glance

### Planned Features
- [ ] As a user, I can drag and drop files from the OS directly into the archive so that adding files is more intuitive
- [ ] As a user, I can search for files within the archive by name or pattern so that I can find entries quickly
- [ ] As a user, I can see a progress bar during long operations (compression, extraction) so that I know how much time remains
- [ ] As a user, I can compare two archives side by side so that I can identify differences
- [ ] As a user, I can preview file contents without extracting so that I can inspect files in-place
