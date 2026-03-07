# Notepad

A full-featured text editor with syntax highlighting, find and replace, encoding support, and developer-friendly editing tools -- the go-to editor for quick edits and serious coding alike inside »SynthelicZ«.

## How It Works

A plain-text editor built around a textarea with a synchronized overlay for syntax highlighting, line numbers, and visual markers. The editor supports multiple programming languages via a pluggable syntax highlighting system, provides code-assist features like auto-indent, bracket matching, code folding, and autocomplete, and integrates with the SZ virtual file system for file operations. All editor preferences are persisted to localStorage.

## User Stories

### File Management
- [x] As a user, I can create a new empty document (Ctrl+N) so that I start with a clean slate
- [x] As a user, I can open files from the virtual file system (Ctrl+O) so that I can edit existing documents
- [x] As a user, I can save the current document (Ctrl+S) so that my changes are persisted
- [x] As a user, I can save a document under a new name with Save As so that I can create copies
- [x] As a user, I can print the current document (Ctrl+P) so that I get a hard copy
- [x] As a user, I can be prompted to save unsaved changes before closing or starting a new file so that I do not lose work
- [x] As a user, I can see the current file name in the window title so that I know which file is open
- [x] As a user, I can see a modification indicator (*) when the document has unsaved changes so that I know to save
- [x] As a user, I can drag and drop files onto the editor to open them so that file opening is quick
- [x] As a user, I can open a file passed via command-line arguments on startup so that file associations work
- [ ] As a user, I can open recent files from a history list so that I can quickly return to previous work
- [ ] As a user, I can open multiple documents in tabs so that I can work on several files at once

### Editing
- [x] As a user, I can undo and redo edits with multi-level undo/redo stacks so that I can revert mistakes
- [x] As a user, I can cut, copy, and paste text (Ctrl+X/C/V) so that I can move content around
- [x] As a user, I can select all text in the document (Ctrl+A) so that I can operate on the entire file
- [x] As a user, I can delete selected text so that I can remove unwanted content
- [x] As a user, I can insert the current time and date with F5 so that I can timestamp entries
- [x] As a user, I can duplicate the current line so that I can quickly repeat content
- [x] As a user, I can toggle comments on the current line or selection using language-appropriate comment prefixes so that I can comment out code
- [x] As a user, I can toggle between insert and overwrite mode so that I can choose my editing behavior
- [x] As a user, I can use auto-indent when pressing Enter to preserve indentation level so that code stays formatted
- [x] As a user, I can have brackets, quotes, and backticks automatically closed when typing an opening character so that I type less
- [x] As a user, I can move lines up and down with Alt+Up and Alt+Down keyboard shortcuts so that I can rearrange code
- [x] As a user, I can indent and unindent selected blocks with Tab and Shift+Tab so that I can adjust indentation
- [x] As a user, I can see autocomplete suggestions based on words already in the document so that I can type faster
- [x] As a user, I can navigate autocomplete suggestions with arrow keys and accept with Enter or Tab so that autocompletion is keyboard-friendly
- [ ] As a user, I can use multi-cursor editing to type in multiple places at once so that I can make parallel edits

### Search
- [x] As a user, I can find text in the document (Ctrl+F) so that I can locate content
- [x] As a user, I can find and replace text (Ctrl+H) so that I can make bulk edits
- [x] As a user, I can search with regular expressions so that I can find complex patterns
- [x] As a user, I can search with case sensitivity so that I can match exact casing
- [x] As a user, I can search for whole words only so that I avoid partial matches
- [x] As a user, I can navigate between matches with Find Next and Find Prev so that I can review each occurrence
- [x] As a user, I can replace a single occurrence or replace all occurrences at once so that I have control over replacements
- [x] As a user, I can go to a specific line number via Go To Line dialog (Ctrl+G) so that I can jump to a known location
- [ ] As a user, I can see a match count indicator while searching so that I know how many results exist

### Syntax Highlighting
- [x] As a user, I can choose from 18 syntax highlighting languages (JavaScript, TypeScript, Python, Java, C, C#, Go, Rust, PHP, Ruby, Perl, Shell, SQL, HTML, CSS, JSON, XML, Markdown) so that code is color-coded
- [x] As a user, I can see keywords, strings, comments, and numbers in distinct colors so that code structure is visible
- [x] As a user, I can use plain text mode with no highlighting so that non-code files display cleanly
- [x] As a user, I can see the current language in the status bar so that I know which mode is active
- [x] As a user, I can click the status bar language to switch syntax modes so that mode switching is quick
- [x] As a user, I can have syntax language auto-detected from the file extension when opening a file so that highlighting is automatic
- [x] As a user, I can select a language from a ribbon dropdown so that I can pick a specific syntax mode
- [ ] As a user, I can define custom syntax highlighting rules so that I can support niche languages

### Display and Navigation
- [x] As a user, I can toggle word wrap on and off so that I can choose how long lines are handled
- [x] As a user, I can show or hide line numbers so that I can reference specific lines
- [x] As a user, I can visualize whitespace characters (spaces and tabs) so that I can see formatting details
- [x] As a user, I can visualize line ending characters so that I can debug line ending issues
- [x] As a user, I can display a long line marker at a configurable column position so that I can enforce line length limits
- [x] As a user, I can highlight the current line with a distinct background color so that I can track my cursor position
- [x] As a user, I can see matching brackets highlighted when the cursor is adjacent to a bracket so that I can verify nesting
- [x] As a user, I can zoom in and out of the editor (Ctrl+Plus/Minus) so that I can adjust readability
- [x] As a user, I can reset the zoom level (Ctrl+0) so that I can return to the default size
- [x] As a user, I can use a minimap to see an overview of the document and navigate by clicking so that I can jump to distant sections
- [x] As a user, I can fold and unfold code blocks by clicking fold markers in the line number gutter so that I can collapse irrelevant sections
- [x] As a user, I can see folded regions shown as a collapsed indicator with a line count badge so that I know what is hidden
- [x] As a user, I can split the editor into two synchronized panes for viewing different parts of the same file so that I can compare sections

### Line Bookmarks
- [x] As a user, I can toggle a bookmark on the current line so that I can mark important locations
- [x] As a user, I can navigate to the next bookmark so that I can jump forward between marked lines
- [x] As a user, I can navigate to the previous bookmark so that I can jump backward between marked lines
- [x] As a user, I can clear all bookmarks at once so that I can start fresh
- [x] As a user, I can see bookmark indicators (dots) next to bookmarked line numbers so that I know which lines are bookmarked

### Sort Lines
- [x] As a user, I can sort lines in ascending order (A-Z) so that I can organize content alphabetically
- [x] As a user, I can sort lines in descending order (Z-A) so that I can reverse-sort content
- [x] As a user, I can sort lines case-insensitively so that casing does not affect sort order
- [x] As a user, I can sort lines numerically so that number-prefixed lines sort correctly
- [x] As a user, I can remove duplicate lines while sorting so that I can deduplicate content

### Case Conversion
- [x] As a user, I can convert selected text or entire document to UPPERCASE so that I can standardize casing
- [x] As a user, I can convert selected text or entire document to lowercase so that I can normalize text
- [x] As a user, I can convert selected text or entire document to Title Case so that I can format headings
- [x] As a user, I can convert selected text or entire document to Sentence case so that I can fix capitalization
- [x] As a user, I can toggle the case of selected text or entire document so that I can quickly swap casing

### Text Statistics
- [x] As a user, I can view a text statistics dialog showing character count, character count without spaces, word count, line count, sentence count, paragraph count, average word length, longest line length, and unique word count so that I can analyze my document

### Encoding and Line Endings
- [x] As a user, I can switch between UTF-8 and ASCII encoding so that I can control the output format
- [x] As a user, I can see the current encoding in the status bar so that I know the active encoding
- [x] As a user, I can detect line ending style automatically when opening a file so that the editor matches the file's format
- [x] As a user, I can convert line endings between CRLF, LF, and CR so that I can target different platforms
- [x] As a user, I can see the current line ending style in the status bar so that I know which line endings are in use
- [x] As a user, I can click the status bar encoding to switch encodings so that changing encoding is quick
- [ ] As a user, I can choose additional encodings like UTF-16, ISO-8859-1, and Windows-1252 so that I can handle legacy files

### Settings
- [x] As a user, I can configure the tab width (2, 4, or 8 spaces) via a dialog so that I can match my project's style
- [x] As a user, I can choose to insert spaces instead of tab characters so that I can use soft tabs
- [x] As a user, I can change the editor font family so that I can use my preferred monospace font
- [x] As a user, I can change the editor font size so that I can adjust readability
- [x] As a user, I can toggle bold and italic font styles so that I can customize the editor appearance
- [x] As a user, I can preview font changes before applying in a Font dialog so that I can see the effect before committing
- [x] As a user, I can persist editor preferences across sessions (saved to localStorage) so that my settings are remembered
- [ ] As a user, I can choose from multiple color themes (dark, light, high-contrast) so that I can match my visual preference

### Status Bar
- [x] As a user, I can see the current cursor position (line and column) in the status bar so that I know where I am in the file
- [x] As a user, I can see the selection length when text is selected so that I know how much text is selected
- [x] As a user, I can see the current encoding, line endings, insert mode, and language at a glance so that I have context about the document
- [x] As a user, I can click status bar items to quickly change settings so that adjustments are convenient
- [x] As a user, I can see a modification indicator in the status bar so that I know if the document has been changed

## Controls / Usage

| Input | Action |
|-------|--------|
| Ctrl+N | New document |
| Ctrl+O | Open file |
| Ctrl+S | Save file |
| Ctrl+P | Print |
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| Ctrl+X/C/V | Cut / Copy / Paste |
| Ctrl+A | Select all |
| Ctrl+F | Find |
| Ctrl+H | Find and Replace |
| Ctrl+G | Go to line |
| F5 | Insert date/time |
| Alt+Up/Down | Move line up/down |
| Tab / Shift+Tab | Indent / Unindent |
| Ctrl+Plus/Minus | Zoom in / out |
| Ctrl+0 | Reset zoom |

## Technical Details

- Single-file IIFE architecture with `window.SZ` global namespace
- Textarea with synchronized syntax-highlight overlay (`<pre><code>`) for rendering
- Line numbers generated via a separate scrollable container synced to editor scroll
- Syntax highlighting uses shared `SZ.SyntaxHighlighter` module with language-specific token rules
- Minimap rendered on a `<canvas>` element with proportional document representation
- Code folding detects brace-delimited regions and tracks collapsed state
- Undo/redo implemented as explicit snapshot stacks (not relying on browser undo)
- Persistent settings stored in localStorage under `sz-notepad-settings`
- File operations via SZ VFS (Kernel32.ReadAllText, WriteFile, ComDlg32 dialogs)
- Ribbon UI with Home, Edit, View, and Tools tabs

## Known Limitations

- No multi-cursor editing support
- No recent files history
- No tabbed document interface for multiple files
- Encoding limited to UTF-8 and ASCII
- Code folding only detects brace-delimited blocks (no language-specific folding rules)
- Autocomplete is word-based only (not language-aware)
