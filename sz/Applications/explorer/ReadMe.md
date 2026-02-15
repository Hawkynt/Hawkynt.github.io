# Explorer

A dual-mode file and object browser for the »SynthelicZ« desktop, combining a virtual filesystem (VFS) navigator with a live JavaScript object inspector -- enabling users to browse files, folders, and the runtime object graph through a familiar Windows Explorer-style interface.

## Product Requirements

### Purpose
Explorer provides a unified browsing experience for both the virtual file system and the live JavaScript runtime object graph within the »SynthelicZ« desktop. It gives users a familiar way to navigate, manage, and inspect files, folders, and application state, serving as the primary file management and system introspection tool in the environment.

### Key Capabilities
- Hierarchical navigation with breadcrumbs, address bar, back/forward/up controls, and autocomplete
- Virtual File System (VFS) browsing with full CRUD operations (create, rename, delete, copy, move)
- File upload from and download to the local machine
- Live JavaScript object inspection with type-aware icons and value previews
- Multi-selection, clipboard operations (copy, cut, paste), and keyboard shortcuts
- Recursive search with result filtering and count limiting
- Sidebar tree view for quick root-level navigation
- Multiple view modes (icons, list, details, tiles) and context menus

### Design Reference
Modeled after Windows Explorer (XP/Vista era) with its dual-pane layout, toolbar, breadcrumb address bar, and sidebar tree -- extended with a JavaScript object browser mode inspired by browser DevTools object inspectors.

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

### Virtual File System (VFS)

- [x] As a user, I can browse the virtual file system starting from the /vfs drive
- [x] As a user, I can see files and folders with appropriate icons (folder, file, drive)
- [x] As a user, I can see file sizes displayed in human-readable format (B, KB, MB)
- [x] As a user, I can see item counts (folders and files) in the status bar
- [x] As a user, I can create new folders in the VFS
- [x] As a user, I can delete files and folders from the VFS
- [x] As a user, I can rename files and folders in the VFS
- [x] As a user, I can copy files within the VFS
- [x] As a user, I can cut and paste (move) files within the VFS
- [x] As a user, I can upload files from my local machine into the VFS
- [x] As a user, I can download files from the VFS to my local machine
- [x] As a user, I can open files from the VFS (images open in a preview, text in notepad, etc.)

### Object Browser

- [x] As a user, I can browse JavaScript runtime objects (SZ, system, parent, self, document)
- [x] As a user, I can see type-specific icons for strings, numbers, booleans, functions, arrays, maps, sets, classes, instances, dates, regexps, symbols, bigints, errors, DOM elements, null, and undefined
- [x] As a user, I can see a preview of each property value (truncated strings, array lengths, constructor names, etc.)
- [x] As a user, I can see detailed views for functions and classes showing their source code
- [x] As a user, I can navigate into container types (objects, arrays, maps, sets, classes, instances, elements) to inspect their properties
- [x] As a user, I can see up to 2000 properties for large objects with a truncation indicator

### Selection and Clipboard

- [x] As a user, I can click an item to select it
- [x] As a user, I can Ctrl+click to toggle individual items in a multi-selection
- [x] As a user, I can Shift+click to select a range of items
- [x] As a user, I can select all items with Ctrl+A
- [x] As a user, I can see the selection count and details in the status bar
- [x] As a user, I can use the Copy toolbar button to copy selected items to the clipboard
- [x] As a user, I can use the Cut toolbar button to mark items for move
- [x] As a user, I can use the Paste toolbar button to paste clipboard contents

### Search

- [x] As a user, I can type in the search box to filter the current directory listing
- [x] As a user, I can perform recursive search within VFS directories
- [x] As a user, I can see search results with their relative paths
- [x] As a user, I can clear the search with the X button or Escape key
- [x] As a user, I can see the result count limited to 200 with an indicator

### Sidebar and Tree View

- [x] As a user, I can see a sidebar tree showing the root-level navigation structure
- [x] As a user, I can click tree nodes to navigate to that location
- [x] As a user, I can see the current location highlighted in the sidebar

### View Modes

- [x] As a user, I can switch between different view modes (icons, list, details, tiles) via the View button
- [x] As a user, I can see files displayed in a grid (icons mode) or list layout
- [ ] As a user, I can sort items by name, type, size, or date in details view
- [ ] As a user, I can resize columns in details view

### Context Menu

- [x] As a user, I can right-click items to see a context menu with available actions
- [x] As a user, I can right-click the background to see folder-level actions (new folder, paste, view mode)
- [ ] As a user, I can see "Properties" in the context menu showing item details in a dialog

### Toolbar

- [x] As a user, I can see toolbar buttons with appropriate enabled/disabled states based on context
- [x] As a user, I can see an overflow menu for toolbar buttons that do not fit
- [x] As a user, I can see toolbar buttons dynamically enable/disable based on VFS vs. object browsing mode

### Keyboard Shortcuts

- [x] As a user, I can press Ctrl+A to select all items
- [x] As a user, I can press Delete to delete selected items
- [x] As a user, I can press F2 to rename the selected item
- [x] As a user, I can press Enter to navigate into a selected folder or open a selected file
- [x] As a user, I can press Backspace to go up to the parent directory
- [x] As a user, I can press Escape to clear the search or exit address bar editing
- [ ] As a user, I can press Ctrl+C/Ctrl+X/Ctrl+V for clipboard operations
- [ ] As a user, I can press Alt+Left/Alt+Right for back/forward navigation

### User Interface

- [x] As a user, I can see a status bar showing item counts and contextual information
- [x] As a user, I can see inline rename editing when pressing F2 or using the rename toolbar button
- [x] As a user, I can see visual feedback with theming via EnableVisualStyles
- [ ] As a user, I can drag and drop files between folders
- [ ] As a user, I can see file previews (thumbnails) for image files
- [ ] As a user, I can see a "favorites" or "quick access" section in the sidebar
