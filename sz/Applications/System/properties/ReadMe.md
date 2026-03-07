# Properties

## Purpose

File and folder properties viewer for the SynthelicZ Desktop. Displays general information (name, path, type, size, modification date) and dynamically loads metadata tabs for supported file types by reusing the metadata-viewer parsers.

## How It Works

A hosted app (class-based, runs directly in the window's content div rather than an iframe). Builds a tabbed UI with a "General" tab showing basic file/folder info. For files, it asynchronously loads the file bytes via the SZ kernel and runs them through the metadata-viewer parsers to discover additional metadata categories (e.g., EXIF data for images, ID3 tags for audio). For folders, it recursively walks the directory tree to compute total item counts and sizes.

## Architecture

- **`app.js`** -- `SZ.Apps['properties']` class with private fields, DOM construction, tab rendering, metadata loading, folder walking
- No `index.html` -- hosted app pattern (injected into window content div)
- CSS injected dynamically (scoped via `.sz-props-app` class)

## Features

### General Tab
- File/folder name
- Path (formatted as SZ:\\ drive path)
- Type (File or Folder; refined to specific file type if metadata available)
- Size (formatted as B/KB/MB)
- Last modified date and time
- Location (VFS localStorage or SZ Object Tree)

### File Metadata
- Async byte loading via `SZ.os.kernel.ReadAllBytes()`
- Loads metadata-viewer parser scripts on demand:
  - parsers-core.js, parsers-image.js, parsers-audio.js, parsers-video.js
  - parsers-document.js, parsers-archive.js, parsers-executable.js, parsers-font.js
- Parses file bytes with `SZ.MetadataParsers.parse()`
- Creates additional tabs for discovered metadata categories
- Filters out deep-inspection categories (General, Resources, Strings, Sections, Imports, Exports, Contents, .NET Assembly, Detection, Classes, etc.) to keep Properties focused
- Updates the Type field in General tab with detected file type name

### Folder Metadata
- Lists direct children via `SZ.os.kernel.List()`
- Stats each child via `SZ.os.kernel.Stat()`
- Shows direct item counts (files and folders) and direct size
- Performs async recursive directory walk for total counts
- Shows total items and total size if different from direct counts
- Incremental rendering (updates after direct children, then after full walk)

### UI
- Tabbed interface with dynamically created tabs
- XP/Windows-style property sheet layout
- Footer with "Open in Metadata Viewer" button (for files) and "Close" button
- Loading spinner during metadata fetch
- Responsive tab bar with overflow scroll
- CSS custom properties for theme integration

### Integration
- Hosted app pattern (`SZ.Apps['properties'] = { Application }`)
- Window title set to "{filename} - Properties"
- "Open in Metadata Viewer" launches metadata-viewer app with same file
- Close button uses SZ window manager
- Reads files via SZ kernel VFS API
- Theme-aware via CSS custom properties (--sz-color-*)

## User Stories

### General Tab
- [x] As a user, I can see a file's name, path, and type so that I know its basic info
- [x] As a user, I can see a file's size in human-readable format (B/KB/MB) so that I know how large it is
- [x] As a user, I can see when a file was last modified so that I know how current it is
- [x] As a user, I can see the storage location (VFS localStorage or SZ Object Tree) so that I understand where the file lives
- [x] As a user, I can see the path formatted as SZ:\\ drive notation so that it matches the desktop convention

### File Metadata
- [x] As a user, I can see the file type auto-detected from content so that I see the real type, not just "File"
- [x] As a user, I can see additional metadata tabs (EXIF, ID3, etc.) for supported file types so that I can inspect metadata without a dedicated viewer
- [x] As a user, I can see metadata parsers loaded on demand so that the properties dialog stays fast
- [x] As a user, I can see deep-inspection categories filtered out (Strings, Sections, Imports, etc.) so that Properties stays focused on summary metadata

### Folder Metadata
- [x] As a user, I can see direct item counts (files and folders) and direct size so that I know the immediate folder contents
- [x] As a user, I can see total items and total size from a recursive directory walk so that I know the full subtree size
- [x] As a user, I can see incremental rendering (direct counts first, then full walk) so that results appear progressively

### User Interface
- [x] As a user, I can see a tabbed interface with dynamically created tabs so that metadata is organized by category
- [x] As a user, I can see the properties window styled like a Windows XP property sheet so that it feels native
- [x] As a user, I can click "Open in Metadata Viewer" to launch the full metadata viewer for deep inspection so that I can switch to detailed analysis
- [x] As a user, I can click "Close" to dismiss the dialog so that I can return to my work
- [x] As a user, I can see a loading spinner while metadata is being fetched so that I know the app is working
- [x] As a user, I can see the window title set to "{filename} - Properties" so that I know which file I am inspecting

### Planned Features
- [ ] As a user, I can edit metadata fields directly in the Properties dialog so that I can make quick changes without switching apps
- [ ] As a user, I can see file permissions and attributes so that I can inspect access control
- [ ] As a user, I can see a preview thumbnail in the General tab so that I can identify the file visually
- [ ] As a user, I can see previous versions or modification history so that I can track changes
- [ ] As a user, I can see checksum values (MD5, SHA-256) in the General tab so that I can verify file integrity
