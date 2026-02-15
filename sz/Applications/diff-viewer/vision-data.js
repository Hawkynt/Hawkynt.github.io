;(function(){window.__visionMd=`# Diff Viewer

A text comparison tool within the »SynthelicZ« desktop that visualizes differences between two documents using Myers diff algorithm, supporting side-by-side, unified, and inline view modes with character-level and word-level diff highlighting.

## Product Requirements

### Purpose
The Diff Viewer provides a visual text comparison utility within the »SynthelicZ« desktop, enabling users to quickly identify differences between two versions of a document. It serves developers comparing code revisions, writers reviewing document edits, and anyone who needs to spot changes between two text files without leaving the desktop environment.

### Key Capabilities
- Side-by-side, unified, and inline diff view modes with synchronized scrolling
- Myers diff algorithm with LCS fallback for large inputs (>20,000 lines)
- Character-level and word-level intra-line diff highlighting
- Comparison options: ignore whitespace, ignore case, ignore line endings
- Diff navigation with previous/next controls and position indicator
- File loading via open dialogs, drag-and-drop (single or dual files), and command line
- Real-time diff statistics showing additions, deletions, modifications, and unchanged lines

### Design Reference
Modeled after diff tools like WinMerge and the Visual Studio Code diff editor, with a dual-panel layout for side-by-side comparison and toolbar controls for view mode switching and navigation.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### Text Input
- [x] As a user, I can paste or type the original text into the left panel
- [x] As a user, I can paste or type the modified text into the right panel
- [x] As a user, I can see placeholder text guiding me to paste or open a file
- [x] As a user, I can open a file into the left (original) panel using a file dialog
- [x] As a user, I can open a file into the right (modified) panel using a file dialog
- [x] As a user, I can swap left and right sides with a button click
- [x] As a user, I can drag and drop files onto either panel to load them
- [x] As a user, I can drag and drop two files at once to compare them immediately
- [x] As a user, I can see the text auto-diff after a short delay (800ms) when typing
- [ ] As a user, I can paste content from the clipboard directly into a panel

### Diff Computation
- [x] As a user, I can see differences computed using the Myers diff algorithm for optimal results
- [x] As a user, I can see a fallback LCS algorithm used for very large inputs (>20,000 lines)
- [x] As a user, I can see added, deleted, modified, and unchanged lines distinguished
- [x] As a user, I can see character-level differences highlighted within modified lines
- [x] As a user, I can enable word-level diff to see differences at word boundaries instead of characters
- [ ] As a user, I can see diff statistics exported as a summary report

### View Modes
- [x] As a user, I can view differences in side-by-side mode (default) with left and right panels
- [x] As a user, I can view differences in unified mode with added/deleted lines interleaved with context
- [x] As a user, I can view differences in inline mode with deletions and additions shown on the same line
- [x] As a user, I can switch between view modes using toolbar buttons
- [x] As a user, I can see the currently active view mode highlighted in the toolbar
- [ ] As a user, I can view a three-way merge diff

### Diff Navigation
- [x] As a user, I can navigate to the next difference with a toolbar button or Ctrl+Down
- [x] As a user, I can navigate to the previous difference with a toolbar button or Ctrl+Up
- [x] As a user, I can see the current difference highlighted distinctly
- [x] As a user, I can see the diff position ("Diff 3 of 7") in the status bar
- [x] As a user, I can see navigation buttons disabled when there are no differences
- [x] As a user, I can see navigation wrap around when reaching the first/last difference
- [ ] As a user, I can click on a diff in the gutter to jump to it

### Comparison Options
- [x] As a user, I can toggle "Ignore whitespace" to treat whitespace differences as equal
- [x] As a user, I can toggle "Ignore case" to perform case-insensitive comparison
- [x] As a user, I can toggle "Ignore line endings" to normalize CR/LF differences
- [x] As a user, I can toggle "Word-level diff" for word-boundary-based comparison
- [x] As a user, I can see the diff recomputed immediately when I change any option
- [ ] As a user, I can ignore blank lines
- [ ] As a user, I can configure context lines shown around differences

### Statistics
- [x] As a user, I can see diff statistics in the toolbar: additions (+), deletions (-), modifications (~), and unchanged lines
- [x] As a user, I can see color-coded statistics (green for adds, red for deletes, yellow for modifications)
- [x] As a user, I can see "Files are identical" when there are no differences

### Synchronized Scrolling
- [x] As a user, I can scroll the left and right panels simultaneously in side-by-side mode
- [x] As a user, I can see both panels stay in sync horizontally and vertically
- [ ] As a user, I can toggle synchronized scrolling on/off

### Panel Layout
- [x] As a user, I can see panel headers showing the file names
- [x] As a user, I can resize the left/right panel split by dragging the splitter
- [x] As a user, I can see unified and inline modes collapse to a single panel with combined header
- [x] As a user, I can double-click on an empty-state area to return to edit mode
- [ ] As a user, I can collapse either panel to full-width single view

### Status Bar
- [x] As a user, I can see the line count for the left file in the status bar
- [x] As a user, I can see the line count for the right file in the status bar
- [x] As a user, I can see the total number of differences in the status bar

### File Operations
- [x] As a user, I can open text files in various formats (txt, md, js, css, html, json, xml, csv)
- [x] As a user, I can open a file from the command line and see it loaded into the left panel
- [x] As a user, I can see the window title reflect both filenames ("file1 vs file2")
- [ ] As a user, I can save the diff output as a unified diff file (.diff/.patch)
- [ ] As a user, I can export the diff as an HTML report

### Keyboard Shortcuts
- [x] As a user, I can use Ctrl+Enter to toggle between edit and diff mode
- [x] As a user, I can use Ctrl+Down to go to the next difference
- [x] As a user, I can use Ctrl+Up to go to the previous difference
- [ ] As a user, I can use Ctrl+O to open files
- [ ] As a user, I can use Ctrl+G to go to a specific line number

### User Interface
- [x] As a user, I can see a toolbar with open, swap, refresh, view mode, and navigation controls
- [x] As a user, I can see an options bar with comparison toggles
- [x] As a user, I can see line numbers and gutter indicators (+/-/~) alongside diff lines
- [x] As a user, I can see character-level additions/deletions colored within modified lines
- [x] As a user, I can see the app styled with system visual styles
- [ ] As a user, I can see syntax highlighting applied to code files in the diff view
`})();
