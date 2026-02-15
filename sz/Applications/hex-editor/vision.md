# Hex Editor

A binary file editor for »SynthelicZ« that displays file contents in a traditional hex dump layout with offset, hex bytes, and ASCII columns, supporting full editing, search, virtual scrolling, and configurable display.

## Product Requirements

### Purpose
Hex Editor provides a low-level binary file inspection and editing tool within the »SynthelicZ« desktop. It allows users to view and modify raw file bytes directly, which is essential for debugging, reverse engineering, data recovery, and examining file formats at the binary level.

### Key Capabilities
- Traditional three-column hex dump display with offset addresses, hex byte values, and ASCII character representation
- Virtual scrolling engine that renders only visible rows for efficient handling of large files
- Full byte editing in both hex and ASCII columns with insert and overwrite modes
- Selection, clipboard operations (cut/copy/paste as hex text), and multi-level undo/redo up to 500 levels
- Hex and ASCII search with match highlighting, next/previous navigation, and match count display
- Go-to-address navigation for jumping directly to specific byte offsets
- Configurable bytes-per-row (8, 16, or 32) with a status bar showing file size, cursor offset, selection size, and editing mode

### Design Reference
Modeled after classic hex editors such as HxD, XVI32, and the Windows built-in hex editing tools, featuring the familiar offset-hex-ASCII three-column layout with modified-byte highlighting.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### File Operations
- [x] As a user, I can create a new empty buffer (Ctrl+N)
- [x] As a user, I can open a binary file using a file dialog (Ctrl+O)
- [x] As a user, I can save the current buffer to disk (Ctrl+S)
- [x] As a user, I can save the buffer with a new name using Save As
- [x] As a user, I can open a file passed via command line arguments
- [x] As a user, I can drag and drop a file onto the editor to open it
- [x] As a user, I can see the filename and dirty indicator in the window title bar
- [x] As a user, I can exit the application from the File menu

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
- [x] As a user, I can switch between 8, 16, or 32 bytes per row from the View menu
- [x] As a user, I can see the current setting indicated with a checkmark in the menu
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

### Menu System
- [x] As a user, I can access File, Edit, View, and Help menus
- [x] As a user, I can see keyboard shortcuts listed in menu items
- [x] As a user, I can see an About dialog from the Help menu

### Future Enhancements
- [ ] As a user, I want a data inspector panel showing the value at the cursor as various types (int8, int16, int32, float, etc.)
- [ ] As a user, I want find and replace functionality
- [ ] As a user, I want to fill a selected range with a specific byte value
- [ ] As a user, I want to see a minimap or scrollbar indicator showing modified regions
- [ ] As a user, I want to compare two files side by side with differences highlighted
- [ ] As a user, I want to export selected bytes or the entire file as a C array, Base64, or other format
- [ ] As a user, I want bookmarks/annotations at specific offsets
- [ ] As a user, I want configurable font size for the hex display
- [ ] As a user, I want structure/template definitions to parse binary formats
