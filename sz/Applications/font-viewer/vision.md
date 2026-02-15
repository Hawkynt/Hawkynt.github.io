# Font Viewer

A desktop-style font browser and inspector that discovers all available system fonts, lets users preview them with custom text and styles, and inspect individual character glyphs with detailed Unicode information inside the »SynthelicZ« desktop environment.

## Product Requirements

### Purpose
The Font Viewer provides a visual font browsing and inspection tool within the »SynthelicZ« desktop, allowing users to explore the fonts available on their system, preview them at various sizes and styles, and inspect individual character glyphs with Unicode metadata. It serves designers, developers, and anyone who needs to choose or examine typefaces without leaving the desktop environment.

### Key Capabilities
- System font discovery and categorized listing (Serif, Sans, Mono, Cursive, Fantasy, System)
- Real-time font filtering and search
- Customizable sample text preview with adjustable size, weight, and color
- Character grid displaying ASCII glyphs in the selected font
- Glyph inspector with Unicode code point, HTML entity, and CSS escape details
- Font information panel showing classification, available weights, and CSS declaration
- File-based font loading from command line arguments

### Design Reference
Modeled after the classic Windows Font Viewer and macOS Font Book, providing a split-pane layout with a font list on the left and a preview/inspection area on the right.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### Font Discovery & Listing
- [x] As a user, I can see a scrollable list of all fonts available on my system
- [x] As a user, I can see each font name rendered in its own typeface for visual preview
- [x] As a user, I can see the total count of discovered fonts
- [x] As a user, I can click on a font to select it and preview it
- [x] As a user, I can navigate the font list with arrow keys (Up/Down)
- [x] As a user, I can see the selected font scrolled into view automatically
- [ ] As a user, I can mark fonts as favorites for quick access
- [ ] As a user, I can sort fonts alphabetically or by classification

### Font Filtering & Search
- [x] As a user, I can filter fonts by typing in a search box
- [x] As a user, I can filter fonts by category (All, Serif, Sans, Mono, Cursive, Fantasy, System)
- [x] As a user, I can see the filtered count update in real time
- [ ] As a user, I can filter fonts by available weight (e.g., only fonts with Bold)

### Sample Text Preview
- [x] As a user, I can see a large preview of the selected font with sample text
- [x] As a user, I can choose between preset sample texts (Pangram, Alphabet, Numbers, Lorem Ipsum, Custom)
- [x] As a user, I can type my own custom sample text in the preview area
- [x] As a user, I can edit the preview text directly (contenteditable)
- [ ] As a user, I can see a waterfall view showing the font at multiple sizes simultaneously
- [ ] As a user, I can compare two fonts side by side

### Style Controls
- [x] As a user, I can adjust the preview font size using a slider (8-120px)
- [x] As a user, I can adjust the preview font size using a numeric input
- [x] As a user, I can select a font weight from a dropdown (100-900)
- [x] As a user, I can toggle bold styling
- [x] As a user, I can toggle italic styling
- [x] As a user, I can change the text color using a color picker
- [ ] As a user, I can change the background color of the preview area
- [ ] As a user, I can adjust letter spacing and line height

### Character Grid & Glyph Inspector
- [x] As a user, I can switch to a "Characters" tab to see a grid of all ASCII characters (32-126)
- [x] As a user, I can see each character in the selected font
- [x] As a user, I can click on a character to inspect it
- [x] As a user, I can see detailed glyph information: character name, Unicode code point, HTML entity, CSS content escape, and decimal value
- [x] As a user, I can see the inspected glyph displayed large in the current font
- [x] As a user, I can see the selected character highlighted in the grid
- [ ] As a user, I can browse extended Unicode blocks beyond basic ASCII
- [ ] As a user, I can copy a glyph's character, HTML entity, or CSS escape to the clipboard with a click
- [ ] As a user, I can see which glyphs are missing/unsupported in the selected font

### Font Information Panel
- [x] As a user, I can see the font family name in the bottom info panel
- [x] As a user, I can see the font classification (Serif, Sans-serif, Monospace, Cursive, Fantasy, or Unclassified)
- [x] As a user, I can see which font weights are available (with named labels like Thin, Normal, Bold, etc.)
- [x] As a user, I can see the CSS font-family declaration for the selected font
- [ ] As a user, I can copy the CSS font-family declaration to the clipboard

### File Operations
- [x] As a user, I can open a font file from the command line and have it loaded and selected
- [x] As a user, I can see the window title update to reflect the loaded font file
- [ ] As a user, I can drag and drop a font file (.ttf, .otf, .woff2) onto the app to load it
- [ ] As a user, I can load multiple custom font files into the viewer
- [ ] As a user, I can export the current preview as an image

### User Interface
- [x] As a user, I can see a split layout with font list on the left and preview on the right
- [x] As a user, I can switch between "Sample" and "Characters" tabs in the main area
- [x] As a user, I can see a toolbar with size, weight, bold/italic, and color controls
- [x] As a user, I can see system visual styles applied to the app
- [ ] As a user, I can resize the sidebar width by dragging
