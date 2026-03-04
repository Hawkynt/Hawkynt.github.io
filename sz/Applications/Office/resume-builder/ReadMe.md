# Resume Builder

A browser-based resume builder for the SynthelicZ desktop environment.

## Purpose

Create professional resumes using a wizard or form-based editor with live styled preview, multiple templates, and export to Markdown, Plain Text, PDF, and DOCX formats.

## How It Works

The app follows the same IIFE + `window.SZ` architecture as other SZ applications. It loads inside an iframe window and communicates with the desktop via `SZ.Dlls` (User32, Kernel32, ComDlg32).

State is managed as a flat `currentData` object keyed by section IDs. Every field edit pushes to an undo stack, updates the data, then triggers preview and completeness score recalculation.

## Architecture

- **templates.js** -- 6 built-in resume templates (Professional, Technical, Academic CV, Creative, Minimal, Entry-Level), each with a `previewLayout` property controlling visual rendering
- **parser.js** -- Imports existing Markdown resumes via heading-to-section fuzzy matching and type-specific parsers
- **controller.js** -- Main logic: state management, field editors (8 resume-specific + 4 reused types), Markdown/Plain Text/DOCX generation, styled preview, completeness checker, file operations, wizard/form modes, template editor, keyboard shortcuts
- **styles.css** -- Layout styling with SZ theme variables, 5 distinct preview layouts, print stylesheet
- **index.html** -- Menus, toolbar, wizard/form panels, preview panel, dialogs

## Features

- [x] 6 built-in resume templates with distinct visual layouts
- [x] Step-by-step wizard mode for guided resume creation
- [x] Form mode with collapsible fieldsets for direct editing
- [x] Live styled preview with 5 layout variants (single-column, sidebar-left, dense-serif, accent-bar, clean-tight)
- [x] Completeness score with warnings (name, email, phone, summary length, experience/education/skills presence)
- [x] Export as Markdown (.md)
- [x] Export as Plain Text (.txt)
- [x] Export as PDF via window.print() with @media print stylesheet
- [x] Export as DOCX (Flat OPC XML)
- [x] Import existing Markdown resumes (paste or file)
- [x] Template editor: duplicate, customize sections, upload/download JSON, VFS load/save
- [x] VFS file operations (New, Open, Save, Save As)
- [x] Undo/Redo (50 levels)
- [x] Keyboard shortcuts (Ctrl+N/O/S/Z/Y, Ctrl+Shift+C for copy Markdown)
- [x] Drag and drop Markdown files
- [x] Resizable split view with draggable splitter (20-80% range)
- [x] Clear all resume data with Edit > Clear All
- [x] Apply a different template to existing data via Templates > Apply Different Template
- [x] Status bar shows line count of generated Markdown resume
- [x] Collapsible form sections in Form Mode (click section header to collapse/expand)
- [x] Command-line file loading: pass file path as argument to open resume on startup
- [x] Window title dirty flag: asterisk (*) prefix indicates unsaved changes
- [x] Custom template JSON import/export: Upload/Download template definitions as JSON files
- [x] VFS template persistence: Load/Save custom templates via virtual filesystem dialogs

### Resume-specific field types

- `personal-info` -- 8-field labeled form (name, title, email, phone, location, website, LinkedIn, GitHub)
- `experience-list` -- Collapsible cards with date inputs, location, bullet sub-list
- `education-list` -- Collapsible cards with institution, degree, field, dates, GPA, honors
- `skills-grouped` -- Repeatable category + comma-separated skills rows
- `certifications-list` -- Collapsible cards (name, issuer, date, credential ID, URL)
- `projects-list` -- Collapsible cards (name, description, technologies, URL)
- `languages-list` -- Language + proficiency dropdown rows
- `references-list` -- Collapsible cards (name, title, company, email, phone)

## Build/Test/Run

No build step. Open `index.html` directly in a browser or launch from the SZ desktop Start Menu (Office category).

### Testing

Browser-based manual verification:
1. Open Resume Builder from Start Menu
2. Wizard: select template, fill personal info, experience, education, skills, finish
3. Form mode: all sections as collapsible fieldsets, live preview updates
4. Switch templates: preview layout changes
5. Export MD/TXT/PDF/DOCX
6. Import: paste or open existing Markdown resume
7. Template editor: duplicate, add/remove sections, save custom, upload/download JSON
8. File ops: New, Open, Save, Save As, dirty flag, undo/redo, keyboard shortcuts

## File Structure

```
index.html        Entry point
controller.js     Main application logic
templates.js      6 built-in template definitions
parser.js         Markdown resume import parser
styles.css        Styling with SZ theme vars + resume preview layouts
icon.svg          App icon
ReadMe.md         This file
```

## Planned Features

- Reorder sections via drag-and-drop in template editor
- Profile photo upload field
- ATS (Applicant Tracking System) keyword analysis
- Cover letter companion generator

## Known Limitations

- DOCX export uses Flat OPC XML (single XML file), not a ZIP-based .docx. Word and LibreOffice open it directly, but some tools may not recognize it.
- PDF export relies on browser print dialog; layout depends on browser rendering.
- No spell-check integration (relies on browser built-in).
- Parser handles common Markdown resume formats but may not parse highly unusual structures.
