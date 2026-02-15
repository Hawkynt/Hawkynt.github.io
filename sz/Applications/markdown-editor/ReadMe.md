# Markdown Editor

A Markdown editor with live preview for »SynthelicZ«, featuring split-pane editing, syntax formatting shortcuts, a built-in Markdown parser, and full file management with dirty-state tracking.

## Product Requirements

### Purpose
Markdown Editor provides a dedicated environment for writing and previewing Markdown documents within the »SynthelicZ« desktop. It enables users to author structured content with a live side-by-side preview, making it ideal for writing documentation, notes, and formatted text without needing a full rich text editor.

### Key Capabilities
- Split-pane interface with draggable splitter and switchable view modes (split, source-only, preview-only)
- Live HTML preview with a built-in Markdown parser supporting headings, emphasis, code blocks, links, images, lists, blockquotes, tables, and horizontal rules
- Toolbar and menu-driven Markdown insertion shortcuts for headings, bold, italic, code, links, images, lists, blockquotes, tables, and horizontal rules
- Full file management with new, open, save, and save-as operations plus dirty-state tracking and unsaved-changes prompts
- Status bar displaying cursor position (line and column) and word count in real time
- Keyboard shortcuts for all major formatting and file operations

### Design Reference
Inspired by popular Markdown editors such as Typora, MarkdownPad, and the VS Code Markdown preview, combining a plain-text source editor with an instant rendered preview in a split-pane layout.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### File Operations
- [x] As a user, I can create a new document (Ctrl+N)
- [x] As a user, I can open an existing Markdown file (Ctrl+O)
- [x] As a user, I can save the current document (Ctrl+S)
- [x] As a user, I can save the document with a new name using Save As
- [x] As a user, I can open a file passed via command line arguments
- [x] As a user, I am prompted to save unsaved changes before creating a new document or opening another
- [x] As a user, I can see an asterisk in the title bar when the document has unsaved changes
- [x] As a user, I can exit the application with an unsaved-changes prompt

### Editor
- [x] As a user, I can type Markdown text in a plain-text editor area
- [x] As a user, I can use the Tab key to insert two spaces for indentation
- [x] As a user, I can see the editor with spellcheck disabled for clean coding
- [x] As a user, I can see a placeholder prompt when the editor is empty

### Live Preview
- [x] As a user, I can see a live-rendered HTML preview of my Markdown content
- [x] As a user, I can see the preview update automatically after a short delay (300ms debounce)
- [x] As a user, I can see headings (h1-h6) rendered in the preview
- [x] As a user, I can see bold, italic, and strikethrough text rendered
- [x] As a user, I can see inline code and fenced code blocks rendered
- [x] As a user, I can see links and images rendered
- [x] As a user, I can see unordered and ordered lists rendered
- [x] As a user, I can see blockquotes rendered
- [x] As a user, I can see horizontal rules rendered
- [x] As a user, I can see tables rendered with headers and body rows
- [x] As a user, I can see paragraphs automatically wrapped

### View Modes
- [x] As a user, I can switch to split view (editor and preview side by side)
- [x] As a user, I can switch to source-only view (editor fills the whole area)
- [x] As a user, I can switch to preview-only view (rendered HTML fills the whole area)
- [x] As a user, I can see the active view mode highlighted in the toolbar
- [x] As a user, I can switch view modes from both the View menu and the toolbar

### Splitter
- [x] As a user, I can drag the splitter between the source and preview panes to resize them
- [x] As a user, I can see the splitter clamped between 20% and 80% of the container width

### Markdown Insertion Shortcuts
- [x] As a user, I can insert a heading prefix from the toolbar or Insert menu
- [x] As a user, I can wrap selected text in bold markers (Ctrl+B)
- [x] As a user, I can wrap selected text in italic markers (Ctrl+I)
- [x] As a user, I can wrap selected text in inline code markers
- [x] As a user, I can wrap selected text in a fenced code block
- [x] As a user, I can insert a Markdown link template (Ctrl+K)
- [x] As a user, I can insert a Markdown image template
- [x] As a user, I can insert a bullet list item prefix
- [x] As a user, I can insert a numbered list item prefix
- [x] As a user, I can insert a blockquote prefix
- [x] As a user, I can insert a horizontal rule
- [x] As a user, I can insert a Markdown table template with headers
- [x] As a user, I see placeholder text selected when wrapping empty selections

### Toolbar
- [x] As a user, I can access formatting buttons (H, B, I, Code) in the toolbar
- [x] As a user, I can access link and image insertion buttons in the toolbar
- [x] As a user, I can access list, blockquote, table, and horizontal rule buttons in the toolbar
- [x] As a user, I can access view mode toggle buttons in the toolbar

### Menu Bar
- [x] As a user, I can access File menu with New, Open, Save, Save As, and Exit
- [x] As a user, I can access Edit menu with Undo, Redo, Cut, Copy, Paste, and Select All
- [x] As a user, I can access Insert menu with all Markdown element insertion options
- [x] As a user, I can access View menu to switch between view modes
- [x] As a user, I can access Help menu with an About dialog

### Status Bar
- [x] As a user, I can see the current cursor position (line and column) in the status bar
- [x] As a user, I can see the word count in the status bar
- [x] As a user, I can see the status bar update as I type or click in the editor

### Keyboard Shortcuts
- [x] As a user, I can use Ctrl+N for new document
- [x] As a user, I can use Ctrl+O to open a file
- [x] As a user, I can use Ctrl+S to save
- [x] As a user, I can use Ctrl+B for bold
- [x] As a user, I can use Ctrl+I for italic
- [x] As a user, I can use Ctrl+K for inserting a link

### Dialogs
- [x] As a user, I can see a save-changes confirmation dialog with Yes, No, and Cancel options
- [x] As a user, I can see an About dialog with application information

### Future Enhancements
- [ ] As a user, I want syntax highlighting in the Markdown source editor
- [ ] As a user, I want synchronized scrolling between the source and preview panes
- [ ] As a user, I want line numbers displayed in the editor
- [ ] As a user, I want to export the rendered HTML to a file
- [ ] As a user, I want to export the document as PDF
- [ ] As a user, I want drag-and-drop file opening
- [ ] As a user, I want auto-save with configurable interval
- [ ] As a user, I want Markdown cheatsheet/help accessible from the Help menu
- [ ] As a user, I want support for task list checkboxes (- [ ] / - [x])
- [ ] As a user, I want support for footnotes in Markdown
- [ ] As a user, I want a word wrap toggle for long lines in the editor
