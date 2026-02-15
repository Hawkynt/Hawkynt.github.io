# Notepad

A full-featured text editor with syntax highlighting, find and replace, encoding support, and developer-friendly editing tools -- the go-to editor for quick edits and serious coding alike inside »SynthelicZ«.

## Product Requirements

### Purpose
Notepad provides a versatile plain-text and code editing experience within the »SynthelicZ« desktop environment. It bridges the gap between a simple text editor for quick notes and a lightweight code editor with syntax highlighting, making it the default tool for viewing, creating, and modifying text-based files. Users rely on it for everything from jotting down quick notes to editing configuration files and writing code.

### Key Capabilities
- File management with new, open, save, save-as, and print operations
- Multi-level undo/redo and clipboard operations (cut, copy, paste)
- Find and replace with regex, case-sensitive, and whole-word matching
- Syntax highlighting for 18 programming languages
- Configurable display options including word wrap, line numbers, whitespace visualization, and zoom
- Encoding and line-ending detection, display, and conversion (UTF-8, ASCII, CRLF/LF/CR)
- Editor customization with configurable tab width, font family, font size, and style
- Rich status bar showing cursor position, selection, encoding, line endings, insert mode, and language

### Design Reference
Modeled after the classic Windows Notepad for simplicity and file handling, combined with lightweight code-editor features inspired by Notepad++ and Visual Studio Code -- syntax highlighting, bracket matching, line numbers, and find-and-replace with regex support.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### File Management
- [x] As a user, I can create a new empty document
- [x] As a user, I can open files from the virtual file system
- [x] As a user, I can save the current document
- [x] As a user, I can save a document under a new name with Save As
- [x] As a user, I can print the current document
- [x] As a user, I can be prompted to save unsaved changes before closing or starting a new file
- [x] As a user, I can see the current file name in the window title
- [x] As a user, I can see a modification indicator when the document has unsaved changes
- [ ] As a user, I can open recent files from a history list
- [ ] As a user, I can open multiple documents in tabs

### Editing
- [x] As a user, I can undo and redo my edits
- [x] As a user, I can cut, copy, and paste text
- [x] As a user, I can select all text in the document
- [x] As a user, I can delete selected text
- [x] As a user, I can insert the current time and date with a shortcut
- [x] As a user, I can duplicate the current line
- [x] As a user, I can toggle comments on the current line or selection
- [x] As a user, I can toggle between insert and overwrite mode
- [x] As a user, I can use auto-indent when pressing Enter
- [x] As a user, I can have brackets automatically closed when I type an opening bracket
- [ ] As a user, I can move lines up and down with keyboard shortcuts
- [ ] As a user, I can use multi-cursor editing to type in multiple places at once
- [ ] As a user, I can drag and drop text within the editor

### Search
- [x] As a user, I can find text in the document
- [x] As a user, I can find and replace text
- [x] As a user, I can search with regular expressions
- [x] As a user, I can search with case sensitivity
- [x] As a user, I can search for whole words only
- [x] As a user, I can navigate between matches with Find Next and Find Prev
- [x] As a user, I can replace all occurrences at once
- [x] As a user, I can go to a specific line number
- [ ] As a user, I can see a match count indicator while searching
- [ ] As a user, I can search and replace across multiple open files

### Syntax Highlighting
- [x] As a user, I can choose from 18 syntax highlighting languages
- [x] As a user, I can see keywords, strings, comments, and numbers in distinct colors
- [x] As a user, I can use plain text mode with no highlighting
- [x] As a user, I can see the current language in the status bar
- [x] As a user, I can click the status bar language to switch syntax modes
- [ ] As a user, I can have the syntax language auto-detected from the file extension
- [ ] As a user, I can define custom syntax highlighting rules

### Display and Navigation
- [x] As a user, I can toggle word wrap on and off
- [x] As a user, I can show or hide line numbers
- [x] As a user, I can visualize whitespace characters
- [x] As a user, I can visualize line ending characters
- [x] As a user, I can display a long line marker at a configurable column
- [x] As a user, I can highlight the current line
- [x] As a user, I can see matching brackets highlighted
- [x] As a user, I can zoom in and out of the editor
- [x] As a user, I can reset the zoom level
- [ ] As a user, I can use a minimap to navigate large files
- [ ] As a user, I can fold and unfold code blocks
- [ ] As a user, I can split the editor into two panes

### Encoding and Line Endings
- [x] As a user, I can switch between UTF-8 and ASCII encoding
- [x] As a user, I can see the current encoding in the status bar
- [x] As a user, I can detect line ending style automatically when opening a file
- [x] As a user, I can convert line endings between CRLF, LF, and CR
- [x] As a user, I can see the current line ending style in the status bar
- [ ] As a user, I can choose additional encodings like UTF-16, ISO-8859-1, and Windows-1252

### Settings
- [x] As a user, I can configure the tab width (2, 4, or 8 spaces)
- [x] As a user, I can choose to insert spaces instead of tab characters
- [x] As a user, I can change the editor font family
- [x] As a user, I can change the editor font size
- [x] As a user, I can toggle bold and italic font styles
- [x] As a user, I can preview font changes before applying
- [ ] As a user, I can persist my editor preferences across sessions
- [ ] As a user, I can choose from multiple color themes (dark, light, high-contrast)

### Status Bar
- [x] As a user, I can see the current cursor position (line and column)
- [x] As a user, I can see the selection length when text is selected
- [x] As a user, I can see the current encoding, line endings, insert mode, and language at a glance
- [x] As a user, I can click status bar items to quickly change settings
