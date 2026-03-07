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

## User Stories

### Templates and Themes
- [x] As a user, I can choose from 6 built-in resume templates with distinct visual layouts so that my resume matches my professional style
- [x] As a user, I can see a live styled preview with 5 layout variants (single-column, sidebar-left, dense-serif, accent-bar, clean-tight) so that I can see how my resume looks in real time
- [x] As a user, I can apply a different template to existing data via Templates > Apply Different Template so that I can experiment with designs without re-entering data

### Editing Modes
- [x] As a user, I can use a step-by-step wizard mode for guided resume creation so that I am walked through each section
- [x] As a user, I can use a form mode with collapsible fieldsets for direct editing so that I can quickly jump to any section
- [x] As a user, I can collapse and expand form sections by clicking section headers so that I can focus on one area at a time

### Resume Content
- [x] As a user, I can enter personal information (name, title, email, phone, location, website, LinkedIn, GitHub) so that my contact details appear on the resume
- [x] As a user, I can add work experience entries with dates, location, and bullet-point descriptions so that my job history is documented
- [x] As a user, I can add education entries with institution, degree, field, dates, GPA, and honors so that my academic background is shown
- [x] As a user, I can add grouped skills with category labels and comma-separated skill lists so that my abilities are organized
- [x] As a user, I can add certifications with name, issuer, date, credential ID, and URL so that my credentials are listed
- [x] As a user, I can add projects with name, description, technologies, and URL so that my portfolio is showcased
- [x] As a user, I can add languages with proficiency levels (Native, Fluent, Professional, Intermediate, Basic) so that my language skills are clear
- [x] As a user, I can add references with name, title, company, email, and phone so that referees are contactable

### Completeness and Validation
- [x] As a user, I can see a completeness score with warnings for missing fields (name, email, phone, summary length, experience/education/skills) so that I know what to improve

### File Operations
- [x] As a user, I can create a new resume (Ctrl+N) so that I start fresh
- [x] As a user, I can open an existing resume file (Ctrl+O) so that I can continue editing
- [x] As a user, I can save the current resume (Ctrl+S) so that my work is persisted
- [x] As a user, I can save the resume with a new name using Save As so that I can create variants
- [x] As a user, I can open a file passed via command-line arguments on startup so that file associations work
- [x] As a user, I can see an asterisk (*) in the window title when the document has unsaved changes so that I know to save
- [x] As a user, I can drag and drop Markdown files onto the editor to open them so that importing is easy

### Import and Export
- [x] As a user, I can export as Markdown (.md) so that I have a portable text format
- [x] As a user, I can export as Plain Text (.txt) so that I have a universal format
- [x] As a user, I can export as PDF via the browser print dialog with a print stylesheet so that I have a polished document
- [x] As a user, I can export as DOCX (Flat OPC XML) so that I can open it in Word or LibreOffice
- [x] As a user, I can import existing Markdown resumes by pasting or opening a file so that I can convert existing content
- [x] As a user, I can copy the generated Markdown to clipboard with Ctrl+Shift+C so that I can quickly share it

### Template Editor
- [x] As a user, I can duplicate a template and customize its sections so that I can create personalized layouts
- [x] As a user, I can upload and download custom template definitions as JSON files so that I can share templates
- [x] As a user, I can load and save custom templates via the virtual filesystem so that templates persist across sessions

### History
- [x] As a user, I can undo and redo changes (up to 50 levels) so that I can revert mistakes
- [x] As a user, I can clear all resume data with Edit > Clear All so that I can start over

### User Interface
- [x] As a user, I can resize the split view with a draggable splitter (20-80% range) so that I can allocate space between the editor and preview
- [x] As a user, I can see the line count of the generated Markdown in the status bar so that I have document metrics
- [x] As a user, I can use keyboard shortcuts (Ctrl+N/O/S/Z/Y) so that I can work efficiently

### Planned Features
- [ ] As a user, I can reorder sections via drag-and-drop in the template editor so that I can control section ordering
- [ ] As a user, I can upload a profile photo so that my resume includes a headshot
- [ ] As a user, I can run ATS (Applicant Tracking System) keyword analysis so that I can optimize for automated screening
- [ ] As a user, I can generate a cover letter companion so that I have a matching letter for each application
- [ ] As a user, I can preview my resume in A4 and US Letter page sizes so that I can check page breaks

### Resume-Specific Field Types

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

## Known Limitations

- DOCX export uses Flat OPC XML (single XML file), not a ZIP-based .docx. Word and LibreOffice open it directly, but some tools may not recognize it.
- PDF export relies on browser print dialog; layout depends on browser rendering.
- No spell-check integration (relies on browser built-in).
- Parser handles common Markdown resume formats but may not parse highly unusual structures.
