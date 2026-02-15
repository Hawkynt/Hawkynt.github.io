;(function(){window.__visionMd=`# WordPad

A rich text editor for »SynthelicZ« featuring a ribbon-style interface, full formatting controls, table editing, multi-format import/export, and a print-layout document view inspired by Microsoft WordPad and Word.

## Product Requirements

### Purpose
WordPad serves as the primary rich text editing application in the »SynthelicZ« desktop, enabling users to create, edit, and format documents with a professional ribbon-based interface. It bridges the gap between a simple text editor and a full word processor, providing essential document authoring capabilities without requiring external tools.

### Key Capabilities
- Full rich text editing with bold, italic, underline, strikethrough, subscript, superscript, font family, font size, and text/highlight colors
- Paragraph formatting including alignment, lists, indentation, line spacing, borders, shading, and heading styles
- Table creation and editing with row/column insertion, deletion, cell merging, and per-cell styling
- Multi-format file support with import/export for HTML, RTF, DOCX, TXT, and PDF (via print)
- Content insertion for images, shapes, text boxes, hyperlinks, bookmarks, symbols, headers, footers, and page breaks
- Find and replace with case-sensitive and regex search modes
- Page layout controls for size, orientation, margins, watermarks, and background color
- Ribbon interface with Home, Insert, Page Layout, and View tabs plus a File backstage and Quick Access Toolbar

### Design Reference
Modeled after Microsoft WordPad with visual and functional influences from Microsoft Word's ribbon interface, including the backstage file menu, tabbed ribbon panels, and print-layout document view.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### File Operations
- [x] As a user, I can create a new document (Ctrl+N)
- [x] As a user, I can open an existing HTML/RTF/TXT file (Ctrl+O)
- [x] As a user, I can save the current document (Ctrl+S)
- [x] As a user, I can save the document with a new name using Save As
- [x] As a user, I can import DOCX files using the mammoth.js library
- [x] As a user, I can import RTF files
- [x] As a user, I can export the document as plain text (.txt)
- [x] As a user, I can export the document as HTML (.html)
- [x] As a user, I can export the document as DOCX using jszip
- [x] As a user, I can export the document as RTF
- [x] As a user, I can export the document as PDF via the browser's print dialog
- [x] As a user, I can print the document (Ctrl+P)
- [x] As a user, I am prompted to save unsaved changes before closing, opening, or creating new documents
- [x] As a user, I can see an asterisk in the title bar indicating unsaved changes
- [x] As a user, I can exit the application from the File backstage

### Text Formatting
- [x] As a user, I can apply bold formatting (Ctrl+B)
- [x] As a user, I can apply italic formatting (Ctrl+I)
- [x] As a user, I can apply underline formatting (Ctrl+U)
- [x] As a user, I can apply strikethrough formatting
- [x] As a user, I can apply subscript formatting
- [x] As a user, I can apply superscript formatting
- [x] As a user, I can change the font family from a dropdown of 15 common fonts
- [x] As a user, I can change the font size from a dropdown of 16 common sizes
- [x] As a user, I can change the text color using a color picker
- [x] As a user, I can apply text highlight/background color
- [x] As a user, I can clear all formatting from selected text
- [x] As a user, I can see formatting buttons toggle state reflect the current selection

### Paragraph Formatting
- [x] As a user, I can align text left, center, right, or justify
- [x] As a user, I can create bulleted lists
- [x] As a user, I can create numbered lists
- [x] As a user, I can increase or decrease indentation
- [x] As a user, I can set line spacing from preset values or a custom value
- [x] As a user, I can apply borders to paragraph blocks
- [x] As a user, I can apply shading to paragraph blocks
- [x] As a user, I can apply block styles (Normal, Heading 1-6, Quote, Code) from a dropdown

### Clipboard
- [x] As a user, I can cut selected text (Ctrl+X)
- [x] As a user, I can copy selected text (Ctrl+C)
- [x] As a user, I can paste content (Ctrl+V)
- [x] As a user, I can paste as plain text via Paste Special
- [x] As a user, I can select all content (Ctrl+A)
- [x] As a user, I can undo changes (Ctrl+Z)
- [x] As a user, I can redo changes (Ctrl+Y)

### Table Editing
- [x] As a user, I can insert a table by specifying rows and columns or using a visual grid picker
- [x] As a user, I can right-click a table cell to access a context menu
- [x] As a user, I can insert rows above or below the current row
- [x] As a user, I can insert columns to the left or right of the current column
- [x] As a user, I can delete rows, columns, or the entire table
- [x] As a user, I can merge cells horizontally
- [x] As a user, I can split previously merged cells
- [x] As a user, I can set a background color on individual table cells
- [x] As a user, I can toggle table borders on and off

### Insert Content
- [x] As a user, I can insert an image from a URL with alt text and optional dimensions
- [x] As a user, I can insert an image from a file via a file dialog
- [x] As a user, I can insert a text box
- [x] As a user, I can insert shapes (rectangle, circle, line)
- [x] As a user, I can insert a hyperlink with custom text (Ctrl+K)
- [x] As a user, I can insert a bookmark/anchor
- [x] As a user, I can insert a page header
- [x] As a user, I can insert a page footer
- [x] As a user, I can insert a page number
- [x] As a user, I can insert special characters from a symbol picker
- [x] As a user, I can insert a horizontal rule
- [x] As a user, I can insert a page break
- [x] As a user, I can insert the current date and time
- [x] As a user, I can select and highlight inserted images by clicking on them

### Find and Replace
- [x] As a user, I can open Find with Ctrl+F
- [x] As a user, I can open Find and Replace with Ctrl+H
- [x] As a user, I can search for text with case-sensitive matching
- [x] As a user, I can search using regular expressions
- [x] As a user, I can find the next or previous occurrence
- [x] As a user, I can replace a single occurrence
- [x] As a user, I can replace all occurrences
- [x] As a user, I can switch between Find and Replace tabs in the panel
- [x] As a user, I can close the Find panel and return focus to the editor

### Page Layout
- [x] As a user, I can set the page size (A4, Letter, Legal, Custom)
- [x] As a user, I can set the page orientation (Portrait, Landscape)
- [x] As a user, I can set page margins (Normal, Narrow, Wide, Custom)
- [x] As a user, I can set paragraph spacing before and after
- [x] As a user, I can set paragraph indentation
- [x] As a user, I can change the page background color
- [x] As a user, I can add a watermark overlay to the document
- [x] As a user, I can remove a previously added watermark

### View Options
- [x] As a user, I can switch between Print Layout, Web Layout, and Outline views
- [x] As a user, I can toggle a ruler display
- [x] As a user, I can toggle gridlines on the editor
- [x] As a user, I can toggle a navigation pane that shows document headings
- [x] As a user, I can click headings in the navigation pane to jump to that section
- [x] As a user, I can toggle formatting marks visibility
- [x] As a user, I can zoom in and out using a slider (25% to 500%)
- [x] As a user, I can reset zoom to 100%, Page Width, or Full Page presets
- [x] As a user, I can see and adjust zoom from both the ribbon and the status bar

### Ribbon Interface
- [x] As a user, I can access Home, Insert, Page Layout, and View tabs
- [x] As a user, I can access the File backstage for file operations
- [x] As a user, I can see a Quick Access Toolbar with Save, Undo, Redo, and Print

### Status Bar
- [x] As a user, I can see the word count in the status bar
- [x] As a user, I can see the character count in the status bar
- [x] As a user, I can see the line count in the status bar
- [x] As a user, I can see and adjust the current zoom level in the status bar

### Dialogs
- [x] As a user, I can see an About dialog with application information
- [x] As a user, I can see a save-changes confirmation dialog

### Future Enhancements
- [ ] As a user, I want spell checking with suggestions
- [ ] As a user, I want word count goals and reading time estimates
- [ ] As a user, I want revision tracking with change highlighting
- [ ] As a user, I want to insert footnotes and endnotes
- [ ] As a user, I want to insert a table of contents generated from headings
- [ ] As a user, I want drag-and-drop image insertion
- [ ] As a user, I want to resize images by dragging handles
- [ ] As a user, I want multi-level list support with custom numbering
`})();
