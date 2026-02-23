# Spreadsheet

A full-featured, browser-based spreadsheet application that aims to provide a familiar Excel-like editing experience inside the »SynthelicZ« desktop environment, supporting formulas, formatting, charting, and file import/export.

## Product Requirements

### Purpose
The Spreadsheet app provides a comprehensive data editing and analysis tool within the »SynthelicZ« desktop, enabling users to work with tabular data, perform calculations, and create visualizations without leaving the browser-based environment. It fills the role of a primary productivity application, making the desktop suitable for real work involving numbers, finances, and structured data.

### Key Capabilities
- Grid-based cell editing with keyboard navigation and multi-selection
- Formula engine with 60+ functions spanning math, statistics, text, logic, lookup, date/time, and financial categories
- Cell formatting including fonts, colors, alignment, number formats, borders, and conditional formatting
- Multi-sheet workbooks with cross-sheet references and named ranges
- Charting (bar, line, pie, scatter, area) from selected data
- File import/export supporting CSV, TSV, and XLSX formats
- Data tools including sorting, filtering, text-to-columns, deduplication, and validation
- Full undo/redo history with clipboard operations and paste special

### Design Reference
Modeled after Microsoft Excel and Google Sheets, with a ribbon-style toolbar organized into tabs (Home, Insert, Formulas, Data, Format) and a formula bar above the grid, replicating the familiar spreadsheet workflow.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### Core Grid & Navigation
- [x] As a user, I can view a grid of cells organized into columns (A-Z) and rows (1-200)
- [x] As a user, I can click on any cell to select it and see its reference in the formula bar
- [x] As a user, I can navigate between cells using the keyboard (arrow keys, Tab, Enter)
- [x] As a user, I can select a range of cells by clicking and dragging
- [x] As a user, I can select multiple non-contiguous ranges using Ctrl+click
- [x] As a user, I can scroll through the grid with smooth virtual rendering
- [ ] As a user, I can use Page Up/Page Down to jump through large sections of the grid
- [ ] As a user, I can use Ctrl+Home/End to jump to the first/last used cell

### Cell Editing
- [x] As a user, I can type text, numbers, and formulas into cells
- [x] As a user, I can edit cell content in the formula bar above the grid
- [x] As a user, I can press F2 or double-click a cell to enter edit mode
- [x] As a user, I can press Escape to cancel an edit
- [x] As a user, I can see formulas prefixed with \`=\` evaluated and their results displayed

### Formula Engine
- [x] As a user, I can use mathematical operators (+, -, *, /, ^, %) in formulas
- [x] As a user, I can reference other cells (e.g., =A1+B2) in formulas
- [x] As a user, I can use cell ranges (e.g., =SUM(A1:A10)) in formulas
- [x] As a user, I can use math functions (SUM, AVERAGE, MIN, MAX, COUNT, ABS, ROUND, SQRT, etc.)
- [x] As a user, I can use statistical functions (MEDIAN, MODE, STDEV, VAR, COUNTIF, SUMIF, AVERAGEIF)
- [x] As a user, I can use text functions (CONCATENATE, LEFT, RIGHT, MID, LEN, UPPER, LOWER, TRIM, etc.)
- [x] As a user, I can use logical functions (IF, AND, OR, NOT, IFERROR, IFS, SWITCH)
- [x] As a user, I can use lookup functions (VLOOKUP, HLOOKUP, INDEX, MATCH, CHOOSE)
- [x] As a user, I can use date/time functions (NOW, TODAY, DATE, YEAR, MONTH, DAY)
- [x] As a user, I can use financial functions (PMT, FV, PV, RATE, NPV, IRR)
- [x] As a user, I can use info functions (ISBLANK, ISNUMBER, ISTEXT, ISERROR, TYPE)
- [x] As a user, I can reference cells across sheets (e.g., =Sheet2!A1)
- [x] As a user, I can define named ranges and use them in formulas
- [x] As a user, I can see cell dependencies automatically recalculated when source values change
- [x] As a user, I can see formula errors displayed (e.g., #ERROR!, #REF!, #DIV/0!)
- [x] As a user, I can toggle "Show Formulas" mode to see raw formulas instead of values
- [x] As a user, I can trace precedents and dependents of a formula cell
- [x] As a user, I can run error checking on formulas
- [x] As a user, I can insert a function from a categorized dialog with search and descriptions

### Formatting
- [x] As a user, I can change the font family of selected cells
- [x] As a user, I can change the font size of selected cells
- [x] As a user, I can apply bold, italic, underline, and strikethrough styles
- [x] As a user, I can change the text color of selected cells
- [x] As a user, I can change the background/fill color of selected cells
- [x] As a user, I can set horizontal alignment (left, center, right)
- [x] As a user, I can set vertical alignment (top, middle, bottom)
- [x] As a user, I can toggle text wrapping within cells
- [x] As a user, I can merge and unmerge cells
- [x] As a user, I can set number formats (General, Number, Currency, Percentage, Date, Time, Scientific, Fraction, Text)
- [x] As a user, I can increase/decrease decimal places
- [x] As a user, I can toggle thousands separators
- [x] As a user, I can apply borders (all, outline, none, bottom) to cells
- [x] As a user, I can use border styles (thin, medium, thick, double, dotted, dashed) and colors
- [x] As a user, I can use the Format Cells dialog for comprehensive formatting
- [x] As a user, I can apply preset cell styles (Good, Bad, Neutral, Heading, Title, etc.)
- [x] As a user, I can apply conditional formatting rules (greater than, less than, equal, between, text contains, top/bottom 10, duplicates)

### Clipboard Operations
- [x] As a user, I can cut, copy, and paste cells using keyboard shortcuts (Ctrl+X/C/V)
- [x] As a user, I can use Paste Special to paste only values, formulas, or formats
- [x] As a user, I can cut and paste cells, moving formulas with relative references
- [ ] As a user, I can paste data from external sources into the grid

### Row & Column Management
- [x] As a user, I can insert rows and columns
- [x] As a user, I can delete rows and columns
- [x] As a user, I can resize column widths by dragging column headers
- [x] As a user, I can set column widths to a specific value via a dialog
- [x] As a user, I can auto-fit column widths to content
- [x] As a user, I can hide and unhide columns
- [x] As a user, I can set row heights via a dialog
- [x] As a user, I can auto-fit row heights
- [x] As a user, I can hide and unhide rows
- [x] As a user, I can group and ungroup rows and columns for outlining

### Sheet Management
- [x] As a user, I can add new sheets using the "+" button
- [x] As a user, I can switch between sheets using tabs at the bottom
- [x] As a user, I can rename sheets
- [x] As a user, I can set tab colors for sheets
- [x] As a user, I can freeze panes at the current row/column
- [x] As a user, I can unfreeze panes

### Sorting & Filtering
- [x] As a user, I can sort data ascending (A-Z) or descending (Z-A)
- [x] As a user, I can use Custom Sort with column selection and header detection
- [x] As a user, I can apply auto-filter to columns
- [x] As a user, I can clear filters

### Data Tools
- [x] As a user, I can use Text to Columns to split text into separate cells
- [x] As a user, I can remove duplicate rows
- [x] As a user, I can set data validation rules on cells
- [x] As a user, I can use Fill Down and Fill Right to copy values/formulas
- [x] As a user, I can use AutoSum to quickly insert a SUM formula

### Find & Replace
- [x] As a user, I can find text across all cells (Ctrl+F)
- [x] As a user, I can find next/previous occurrences
- [x] As a user, I can replace one or all occurrences of text
- [x] As a user, I can see status messages about find/replace results

### Charts
- [x] As a user, I can create bar charts from selected data
- [x] As a user, I can create line charts from selected data
- [x] As a user, I can create pie charts from selected data
- [x] As a user, I can create scatter charts from selected data
- [x] As a user, I can create area charts from selected data
- [x] As a user, I can view charts in a dialog overlay with a canvas
- [ ] As a user, I can embed charts inline within the spreadsheet grid
- [ ] As a user, I can customize chart colors, labels, and legends

### File Operations
- [x] As a user, I can create a new blank spreadsheet (Ctrl+N)
- [x] As a user, I can open files using a file dialog (Ctrl+O)
- [x] As a user, I can save the current spreadsheet (Ctrl+S)
- [x] As a user, I can save as a new file
- [x] As a user, I can import CSV files
- [x] As a user, I can export as CSV files
- [x] As a user, I can import TSV files
- [x] As a user, I can export as TSV files
- [x] As a user, I can import XLSX files (via SheetJS library)
- [x] As a user, I can export as XLSX files (via SheetJS library)
- [x] As a user, I can see a dirty indicator (*) in the title when unsaved changes exist

### Undo/Redo
- [x] As a user, I can undo changes (Ctrl+Z) up to 100 levels
- [x] As a user, I can redo undone changes (Ctrl+Y)
- [ ] As a user, I can see an undo history list

### User Interface
- [x] As a user, I can use a ribbon toolbar organized into tabs (Home, Insert, Formulas, Data, Format)
- [x] As a user, I can use a File menu for file operations (New, Open, Save, Import, Export)
- [x] As a user, I can see the current cell reference and formula in the formula bar
- [x] As a user, I can see a status bar showing cell status and summary statistics for selections
- [x] As a user, I can see sheet tabs at the bottom for multi-sheet navigation
- [x] As a user, I can use a color picker palette for font and background colors
- [x] As a user, I can see the app title reflect the current filename
- [x] As a user, I can print the spreadsheet using Ctrl+P or File > Print
- [x] As a user, I can insert hyperlinks into cells with clickable behavior
- [x] As a user, I can add and view cell comments with a red triangle indicator
- [x] As a user, I can zoom in/out from 25% to 500% using the zoom slider in the status bar

### Keyboard Shortcuts
- [x] As a user, I can use Ctrl+B/I/U for bold/italic/underline
- [x] As a user, I can use Ctrl+N for new file
- [x] As a user, I can use Ctrl+O for open file
- [x] As a user, I can use Ctrl+S for save
- [x] As a user, I can use Ctrl+X/C/V for cut/copy/paste
- [x] As a user, I can use Ctrl+Z/Y for undo/redo
- [x] As a user, I can use Ctrl+F for find and replace
- [x] As a user, I can use Delete to clear cell content
- [x] As a user, I can use arrow keys and Tab/Enter for cell navigation
- [ ] As a user, I can use Ctrl+; to insert the current date
- [ ] As a user, I can use Ctrl+Shift+; to insert the current time
