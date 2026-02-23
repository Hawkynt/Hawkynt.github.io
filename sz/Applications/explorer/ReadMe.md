# Explorer

A feature-rich, FilePilot-inspired dual-mode file and object browser for the »SynthelicZ« desktop, combining a virtual filesystem (VFS) navigator with a live JavaScript object inspector -- enabling users to browse files, folders, and the runtime object graph through a modern tabbed interface with ribbon UI, preview pane, and multiple view modes.

## Product Requirements

### Purpose
Explorer provides a unified browsing experience for both the virtual file system and the live JavaScript runtime object graph within the »SynthelicZ« desktop. It gives users a familiar way to navigate, manage, and inspect files, folders, and application state, serving as the primary file management and system introspection tool in the environment.

### Key Capabilities
- Office-style ribbon UI with Quick Access Toolbar, Home/View tabs, and File backstage menu
- **Multi-pane layout** -- arbitrarily many file panels with Split Right/Bottom, resizable splitters, and drag-and-drop rearrangement with blue drop-zone previews
- Navigation tabs with independent state per tab (path, history, selection, scroll position)
- Per-pane hierarchical navigation with breadcrumbs, address bar, back/forward/up controls, and autocomplete
- Virtual File System (VFS) browsing with full CRUD operations (create, rename, delete, copy, move)
- Three view modes: Icons (grid with zoom levels), Details (sortable table with resizable columns, folder/file count columns, column filter icons), and Tiles (wider cards)
- **Expand Folder mode** (Ctrl+E) -- flatten all subdirectory contents into the current view with relative path breadcrumbs
- **Inspector / Preview pane** with previous/next file navigation, zoom controls, Space bar toggle, image/text/audio/video/hex previews and metadata
- **Command Palette** (Ctrl+Shift+P) -- searchable list of all commands and actions
- **GoTo window** (Ctrl+P / F4) -- dedicated path/folder jump dialog with recent locations
- **Sidebar with sections**: Recents, Bookmarks, Quick Access, Storage (color-coded usage bars), Places (well-known folders), and Tree -- all collapsible with filter search box
- **Bulk rename** with pattern support ({name}, {ext}, {counter}, {date}, {id} tokens)
- **View filtering** -- quick filter icons to show files only, folders only, or both; folders-first toggle
- **Display toggles**: hidden files, file extensions, highlight recents, sort recents, system files
- **Options dialog** (Ctrl+,) for font size, row spacing, icon zoom level, and default view mode
- Drag-and-drop files between panes (move by default, Ctrl to copy) and from OS into VFS
- File upload from and download to the local machine
- Live JavaScript object inspection with type-aware icons and value previews
- Multi-selection, clipboard operations (copy, cut, paste), and keyboard shortcuts
- Enhanced recursive search with scope toggle (current folder or all VFS), detail-format results, and fuzzy matching
- Sorting by name, size, type, or date with ascending/descending toggle
- **Rich status bar** with view filter icons, item counts, directory load time, selection info, view mode indicator, and scroll position percentage
- "Open with" submenu, "Copy as path", "New folder with selection", "Add to Bookmarks" context menu actions
- Type-ahead file selection (type characters to jump to matching file)
- Save/Load layout persistence for multi-pane arrangements
- Directory change watching (auto-refresh when VFS changes externally)
- Folder size calculation and usage indicators in Details view
- Mount/unmount local folders via File System Access API
- Persisted settings via registry (view mode, preview pane, navigation pane, quick access, bookmarks, recents, layout, display toggles, font/spacing/zoom)

### Design Reference
Inspired by [FilePilot](https://filepilot.tech) -- a modern file manager with multi-panel tabs, inspector/preview pane, and keyboard-first design. Also modeled after Windows Explorer with its dual-pane layout, breadcrumb address bar, and sidebar tree -- extended with a JavaScript object browser mode inspired by browser DevTools object inspectors.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### Core Navigation

- [x] As a user, I can navigate a hierarchical path structure using forward slash-separated paths
- [x] As a user, I can click breadcrumb segments to jump to any ancestor directory
- [x] As a user, I can type a path directly into the address bar and press Enter to navigate
- [x] As a user, I can use the Back button to return to the previously visited location
- [x] As a user, I can use the Forward button to revisit a location after going back
- [x] As a user, I can use the Up button to navigate to the parent directory
- [x] As a user, I can click the Refresh button to reload the current directory listing
- [x] As a user, I can double-click a folder or container to navigate into it
- [x] As a user, I can see an autocomplete dropdown when typing in the address bar
- [x] As a user, I can use arrow keys and Tab/Enter to select autocomplete suggestions

### Navigation Tabs

- [x] As a user, I can open multiple tabs each with independent path, history, and selection
- [x] As a user, I can create new tabs with Ctrl+T or the + button
- [x] As a user, I can close tabs with Ctrl+W or the X button on each tab
- [x] As a user, I can middle-click a folder to open it in a new tab
- [x] As a user, I can right-click a folder and choose "Open in New Tab"
- [x] As a user, I can switch between tabs by clicking them
- [x] As a user, I can see the tab bar auto-hide when only one tab is open
- [x] As a user, I can drag a tab from one pane and drop it onto another pane to transfer it
- [x] As a user, I can reorder tabs within a pane by dragging them

### Virtual File System (VFS)

- [x] As a user, I can browse the virtual file system starting from the /vfs drive
- [x] As a user, I can see files and folders with appropriate icons (folder, file, drive)
- [x] As a user, I can see file sizes displayed in human-readable format (B, KB, MB)
- [x] As a user, I can see item counts (folders and files) in the status bar
- [x] As a user, I can create new folders in the VFS
- [x] As a user, I can create new text documents in the VFS
- [x] As a user, I can delete files and folders from the VFS
- [x] As a user, I can rename files and folders in the VFS
- [x] As a user, I can copy files within the VFS
- [x] As a user, I can cut and paste (move) files within the VFS
- [x] As a user, I can upload files from my local machine into the VFS
- [x] As a user, I can download files from the VFS to my local machine
- [x] As a user, I can open files from the VFS (images open in a preview, text in notepad, etc.)
- [x] As a user, I can mount local folders from my OS into the VFS
- [x] As a user, I can unmount previously mounted folders

### Object Browser

- [x] As a user, I can browse JavaScript runtime objects (SZ, system, parent, self, document)
- [x] As a user, I can see type-specific icons for strings, numbers, booleans, functions, arrays, maps, sets, classes, instances, dates, regexps, symbols, bigints, errors, DOM elements, null, and undefined
- [x] As a user, I can see a preview of each property value (truncated strings, array lengths, constructor names, etc.)
- [x] As a user, I can see detailed views for functions and classes showing their source code with syntax highlighting
- [x] As a user, I can navigate into container types (objects, arrays, maps, sets, classes, instances, elements) to inspect their properties
- [x] As a user, I can see up to 2000 properties for large objects with a truncation indicator

### Selection and Clipboard

- [x] As a user, I can click an item to select it
- [x] As a user, I can Ctrl+click to toggle individual items in a multi-selection
- [x] As a user, I can Shift+click to select a range of items
- [x] As a user, I can select all items with Ctrl+A
- [x] As a user, I can select none to clear the selection
- [x] As a user, I can invert the selection
- [x] As a user, I can see the selection count and total size in the status bar
- [x] As a user, I can use the ribbon Copy/Cut/Paste buttons for clipboard operations
- [x] As a user, I can see cut items displayed with reduced opacity

### Search

- [x] As a user, I can type in the search box to filter the current directory listing
- [x] As a user, I can perform recursive search within VFS directories
- [x] As a user, I can toggle search scope between "Current folder" and "All VFS"
- [x] As a user, I can see search results in a detail table with a Path column
- [x] As a user, I can see search results with their relative paths
- [x] As a user, I can clear the search with the X button or Escape key
- [x] As a user, I can see the result count limited to 200 with an indicator

### Quick Access

- [x] As a user, I can see a Quick Access section at the top of the sidebar with pinned folders
- [x] As a user, I can right-click a folder and choose "Pin to Quick Access"
- [x] As a user, I can unpin folders from Quick Access via right-click or the sidebar context menu
- [x] As a user, I can collapse/expand the Quick Access section
- [x] As a user, I can see Quick Access pins persisted across sessions

### Sidebar and Tree View

- [x] As a user, I can see a sidebar tree showing the root-level navigation structure
- [x] As a user, I can click tree nodes to navigate to that location
- [x] As a user, I can see the current location highlighted in the sidebar
- [x] As a user, I can toggle the navigation pane visibility from the View ribbon tab

### View Modes

- [x] As a user, I can switch between Icons, Details, and Tiles views from the View ribbon tab
- [x] As a user, I can see a persisted view mode across sessions
- [x] As a user, I can sort items by name, size, type, or date in any view
- [x] As a user, I can click column headers in Details view to sort (toggle ascending/descending)
- [x] As a user, I can resize columns in Details view by dragging column borders
- [x] As a user, I can see folders sorted before files regardless of sort field
- [x] As a user, I can see the current view mode in the status bar

### Preview Pane

- [x] As a user, I can toggle the preview pane from the View ribbon tab
- [x] As a user, I can see image thumbnails for selected image files
- [x] As a user, I can see text preview (first 100 lines) for text-based files
- [x] As a user, I can see audio/video playback controls for media files
- [x] As a user, I can see hex preview for binary files (first 256 bytes)
- [x] As a user, I can see file metadata (name, type, size, date) below the preview
- [x] As a user, I can see folder info when no file is selected
- [x] As a user, I can see multi-selection summary (item count, total size)

### Ribbon UI

- [x] As a user, I can see a Quick Access Toolbar with Back/Forward/Up/Refresh buttons
- [x] As a user, I can switch between Home and View ribbon tabs
- [x] As a user, I can access the File backstage for New Window, Mount, Unmount, About, and Exit
- [x] As a user, I can see ribbon buttons enable/disable based on context (VFS mode, selection state)
- [x] As a user, I can see grouped ribbon buttons: Clipboard, Organize, Transfer, Selection (Home), Layout, Panes, Sort By, Display (View)

### Context Menu

- [x] As a user, I can right-click items to see a context menu with available actions
- [x] As a user, I can right-click the background to see folder-level actions (new folder/file, paste, refresh)
- [x] As a user, I can see Properties in the context menu showing item details in a dialog
- [x] As a user, I can see "Open in New Tab" for folders in the context menu

### Keyboard Shortcuts

- [x] As a user, I can press Ctrl+A to select all items
- [x] As a user, I can press Delete to delete selected items
- [x] As a user, I can press F2 to rename the selected item
- [x] As a user, I can press F5 to refresh the current view
- [x] As a user, I can press Enter to navigate into a selected folder or open a selected file
- [x] As a user, I can press Backspace to go up to the parent directory
- [x] As a user, I can press Escape to clear the search or exit address bar editing
- [x] As a user, I can press Ctrl+C/Ctrl+X/Ctrl+V for clipboard operations
- [x] As a user, I can press Alt+Left/Alt+Right for back/forward navigation
- [x] As a user, I can press Alt+Up to navigate to the parent directory
- [x] As a user, I can press Ctrl+T to open a new tab
- [x] As a user, I can press Ctrl+W to close the current tab

### Status Bar

- [x] As a user, I can see item counts with folder/file breakdown in the status bar
- [x] As a user, I can see selection info (count and total size) when items are selected
- [x] As a user, I can see the current view mode indicator on the right side of the status bar

### User Interface

- [x] As a user, I can see visual feedback with theming via CSS custom properties
- [x] As a user, I can drag and drop files from my OS into the VFS
- [x] As a user, I can see file previews (thumbnails) in the preview pane
- [x] As a user, I can see a Quick Access / favorites section in the sidebar

## Implemented Features (formerly Planned)

### Multi-Pane & Layout
- [x] Multi-pane mode -- arbitrarily many file panels, each with independent tabs and navigation
- [x] Split Right (Ctrl+Shift+S) and Split Bottom (Ctrl+S) to create new panes from the current one
- [x] Pane arrangement via drag-and-drop with blue drop-zone preview indicators
- [x] Resizable splitters between panes (drag to resize)
- [x] Drag-and-drop files between panes (move by default, Ctrl modifier to copy)
- [x] Save Layout -- persist current multi-pane arrangement to restore later
- [x] Load Layout -- restore a previously saved pane arrangement

### Sidebar Enhancements
- [x] Filter/search box at top of sidebar to filter tree items
- [x] Recents section -- recently visited folders, collapsible
- [x] Bookmarks section -- separate organized bookmark groups (distinct from Quick Access pins)
- [x] Storage section -- drive listing with color-coded usage bars (blue/green/red by capacity)
- [x] Places section -- well-known locations (This PC, Desktop, Downloads, Documents, Music, Pictures, Videos, Recycle Bin)
- [x] Collapsible sidebar sections with chevron toggles (Recents, Bookmarks, Storage, Places)

### Expand Folder (Flatten)
- [x] Toggle Expand Folder (Ctrl+E) -- flatten all subdirectory contents into current view
- [x] Expanded items show relative path breadcrumbs next to each item name
- [x] Tab title shows [...] indicator when in expanded/flattened mode

### Inspector / Preview Pane Enhancements
- [x] Toggle Inspector via Space bar shortcut
- [x] Previous/Next file navigation arrows in inspector to cycle through files
- [x] Zoom controls and zoom percentage display in inspector
- [x] Animated/video thumbnail previews in icon and tile views

### Display Toggles
- [x] Toggle File Extension visibility (show/hide extensions)
- [x] Toggle System Files visibility
- [x] Toggle Highlight Recents -- visually highlight recently modified files
- [x] Toggle Sort Recents -- sort recently modified files to top of listing

### View Filtering
- [x] Quick filter icons to show only files, only folders, or both
- [x] Sort grouping toggle -- folders first then files, or mixed together interleaved by sort order

### Detail View Columns
- [x] Folders count column in details view (number of subfolders)
- [x] Files count column in details view (number of files)
- [x] Column header filter icons -- per-column filtering (e.g., filter by type)

### Context Menu Enhancements
- [x] "Open with" submenu showing available SZ applications for the file type
- [x] "New folder with selection" -- create a new folder from selected items and move them into it
- [x] "Copy as path" -- copy full file path to clipboard
- [x] Image-specific context actions (rotate right, rotate left)
- [x] "Add to Bookmarks/Favorites" context action on folders

### Command Palette & Navigation
- [x] Command palette (Ctrl+Shift+P) -- searchable list of all available commands and actions
- [x] GoTo window (Ctrl+P / F4) -- dedicated path/folder jump dialog with recent locations
- [x] Fuzzy search with flattened hierarchy results

### Bulk Operations
- [x] Bulk rename with pattern support (ID, date, counter options -- FilePilot-inspired)
- [x] Keyboard-driven file selection (type-ahead to select by typing name prefix)
- [x] Arrow key navigation (Up/Down/Left/Right) with Shift+Arrow for multi-selection
- [x] Home/End/PageUp/PageDown navigation with optional multi-selection
- [x] Alt+Enter shortcut to open Properties dialog for selected items
- [x] Lasso/rubber-band selection by dragging a rectangle on the background
- [x] Right-click tab to Duplicate Tab; middle-click tab to close it

### View Enhancements
- [x] Zoom levels for icon sizes (small, medium, large, extra large)
- [x] In-app font, spacing, and density customization (Options dialog, Ctrl+,)

### Status Bar Enhancements
- [x] Directory load time display (e.g., "1.25 sec")
- [x] Separate folder/file totals with current-visible/total format (e.g., "9/36 folders")
- [x] Scroll position percentage indicator

### Context Menu Icons
- [x] All context menu entries have SVG icons (Open, Cut, Copy, Paste, Delete, Rename, Properties, Download, etc.)
- [x] "Open with" submenu shows each app's own icon
- [x] Sidebar context menus (Remove bookmark, Unpin quick access) have icons
- [x] Desktop and taskbar right-click menus have icons for all entries

### Desktop ↔ VFS Integration
- [x] Desktop shows files from `/user/desktop` VFS folder as desktop icons
- [x] Drag-and-drop files from Explorer to desktop copies/moves them to `/user/desktop`
- [x] Drag-and-drop OS files onto desktop writes them to `/user/desktop`
- [x] Desktop auto-refreshes when VFS operations modify `/user/desktop`
- [x] Desktop context menu Paste copies/moves clipboard items to `/user/desktop`
- [x] File type icons on desktop match the associated application's icon
- [x] Double-clicking VFS files on desktop opens them with the appropriate app
- [x] Double-clicking VFS folders on desktop opens them in Explorer

### Other
- [x] Open Console -- open a terminal/command line at the current path
- [x] File type filtering with persistent filter settings
- [x] Searchable tabs popup for managing many open tabs
- [x] Directory change watching (auto-refresh when VFS changes externally)
- [x] Folder size calculation and usage indicators in Details view
- [x] Drag-and-drop reordering and moving within the VFS
- [x] Close tab via Ctrl+F4 in addition to Ctrl+W and middle-click
- [x] Rubber-band/lasso selection rectangle when dragging on background
- [x] Inter-pane drag-and-drop (move by default, Ctrl to copy)
- [x] Copy JavaScript objects from object browser to VFS as files (.js, .json, .txt)
- [x] Bulk rename preview with aligned columns (old name | → | new name)
- [x] Copy as Path produces VFS-relative paths usable in Open/Save dialogs
