;(function(){window.__visionMd=`# JSON Viewer

A dual-pane JSON viewer and editor for inspecting, transforming, and managing JSON data inside the »SynthelicZ« desktop environment, featuring a raw text editor alongside an interactive collapsible tree view with real-time validation and search.

## Product Requirements

### Purpose
The JSON Viewer provides a dedicated JSON inspection and editing tool within the »SynthelicZ« desktop, enabling developers and power users to paste, open, validate, explore, and transform JSON data with immediate visual feedback. It eliminates the need for external online JSON tools by offering a local, offline-capable alternative built into the desktop.

### Key Capabilities
- Dual-pane layout with raw text editor and interactive collapsible tree view
- Real-time JSON validation with error reporting including line and column numbers
- Tree navigation with JSON path display, expand/collapse controls, and click-to-copy values
- JSON transformations: prettify, minify, sort keys, flatten, and unflatten
- Full-text search across keys and values with match navigation
- File operations with New, Open, Save, Save As, and drag-and-drop support
- Status bar showing validation state, file size, node count, and selected path

### Design Reference
Inspired by standalone JSON editors like JSON Editor Online and the Chrome DevTools JSON viewer, combining a raw text editing pane with a structured tree explorer in a resizable split layout.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### JSON Editing
- [x] As a user, I can type or paste JSON text into the editor textarea
- [x] As a user, I can see a placeholder prompting me to paste or type JSON
- [x] As a user, I can see the editor auto-parse my input with debounced updates (300ms)
- [x] As a user, I can see the dirty state reflected with a \`*\` prefix in the window title
- [ ] As a user, I can see syntax highlighting in the editor textarea
- [ ] As a user, I can see line numbers in the editor

### Validation & Error Reporting
- [x] As a user, I can see whether my JSON is valid, invalid, or the editor is empty ("Ready")
- [x] As a user, I can see parse error messages with line and column numbers in an error bar
- [x] As a user, I can validate JSON on demand (F5) and have the cursor jump to the error position
- [x] As a user, I can see validation status in the status bar (Valid/Invalid/Ready) with color coding
- [ ] As a user, I can validate JSON against a JSON Schema

### Tree View
- [x] As a user, I can see parsed JSON rendered as an interactive tree with syntax coloring
- [x] As a user, I can see objects and arrays with expand/collapse toggles
- [x] As a user, I can see collapsed nodes show a summary (e.g., "// 3 keys" or "// 5 items")
- [x] As a user, I can expand all nodes in the tree
- [x] As a user, I can collapse all nodes in the tree
- [x] As a user, I can click on a tree line to select it and see its JSON path in the status bar
- [x] As a user, I can click on a value in the tree to copy it to the clipboard
- [x] As a user, I can see a "Copied!" tooltip when a value is copied
- [x] As a user, I can see different colors for strings, numbers, booleans, null, keys, and brackets
- [ ] As a user, I can edit values directly in the tree view
- [ ] As a user, I can right-click a tree node to add, delete, or rename keys

### JSON Transformations
- [x] As a user, I can prettify JSON with indentation (Ctrl+Shift+F)
- [x] As a user, I can minify JSON to remove whitespace
- [x] As a user, I can sort all object keys alphabetically (recursively)
- [x] As a user, I can flatten nested objects to dot-notation keys
- [x] As a user, I can unflatten dot-notation keys back to nested objects
- [x] As a user, I can copy all JSON text to the clipboard (Ctrl+Shift+C)
- [ ] As a user, I can convert JSON to YAML format
- [ ] As a user, I can convert JSON to CSV for array-of-objects data

### Search
- [x] As a user, I can open a search bar with Ctrl+F
- [x] As a user, I can search for text across keys and values in the tree
- [x] As a user, I can navigate between matches using Prev/Next buttons or Enter/Shift+Enter
- [x] As a user, I can see the match count and current position (e.g., "3/7")
- [x] As a user, I can see matching lines highlighted and the active match scrolled into view
- [x] As a user, I can close the search bar with the X button or Escape
- [ ] As a user, I can filter the tree to show only matching nodes

### File Operations
- [x] As a user, I can create a new empty document (Ctrl+N)
- [x] As a user, I can open a JSON file using a file dialog (Ctrl+O)
- [x] As a user, I can save the current JSON to a file (Ctrl+S)
- [x] As a user, I can save as a new file with Save As
- [x] As a user, I can open a file from the command line and see it loaded automatically
- [x] As a user, I can drag and drop a JSON file onto the app to load it
- [ ] As a user, I can open files from a URL

### Status Bar
- [x] As a user, I can see the validation status in the status bar
- [x] As a user, I can see the file size in bytes
- [x] As a user, I can see the node count of the parsed JSON
- [x] As a user, I can see the JSON path of the selected tree node

### User Interface
- [x] As a user, I can see a menu bar with File, Edit, View, and Help menus
- [x] As a user, I can see a toolbar with quick-access buttons for common actions
- [x] As a user, I can resize the editor/tree split by dragging the splitter
- [x] As a user, I can see an About dialog with app information
- [x] As a user, I can use keyboard shortcuts for all major actions
- [x] As a user, I can see the window title show the current filename
- [x] As a user, I can start with sample JSON data pre-loaded
- [ ] As a user, I can toggle between light and dark theme for the editor
- [ ] As a user, I can view a JSON diff between the original and edited version

### Keyboard Shortcuts
- [x] As a user, I can use Ctrl+N for New
- [x] As a user, I can use Ctrl+O for Open
- [x] As a user, I can use Ctrl+S for Save
- [x] As a user, I can use Ctrl+F for Find
- [x] As a user, I can use Ctrl+Shift+F for Prettify
- [x] As a user, I can use Ctrl+Shift+C for Copy All
- [x] As a user, I can use F5 for Validate
`})();
