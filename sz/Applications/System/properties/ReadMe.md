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

- [x] As a user, I want to see a file's name, path, and type so I know its basic info
- [x] As a user, I want to see a file's size in human-readable format so I know how large it is
- [x] As a user, I want to see when a file was last modified so I know how current it is
- [x] As a user, I want to know if a file is stored in VFS or the object tree so I understand its location
- [x] As a user, I want to see metadata tabs (EXIF, ID3, etc.) for supported file types so I can inspect metadata without opening a dedicated viewer
- [x] As a user, I want the file type to be auto-detected from content so I see the real type, not just "File"
- [x] As a user, I want to open the full metadata viewer from properties so I can do deep inspection
- [x] As a user, I want to see folder contents summary (file/folder counts and total size) so I understand directory scope
- [x] As a user, I want recursive totals for nested folders so I know the full subtree size
- [x] As a user, I want a loading spinner while metadata loads so I know the app is working
- [x] As a user, I want the properties window to look like a Windows property sheet so it feels native
