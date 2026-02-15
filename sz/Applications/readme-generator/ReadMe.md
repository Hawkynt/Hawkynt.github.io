# README Generator

A developer tool for creating professional, standardized README.md files with guided templates, a step-by-step wizard, customizable template editor, and live markdown preview. It parses existing READMEs on import, scores document quality in real time, and supports 11 structured field types for precise section editing.

## Product Requirements

### Purpose
The README Generator helps developers produce consistent, high-quality README.md files without starting from a blank page. It addresses the common problem of incomplete or poorly structured project documentation by providing opinionated templates, guided workflows, and automated quality feedback -- making it useful for open-source maintainers, library publishers, CLI tool authors, and anyone who needs a professional README quickly.

### Key Capabilities
- Five built-in templates covering the most common project types (Standard Project, Minimal, Library/Package, CLI Tool, GitHub Profile)
- Two editing modes: a step-by-step wizard for focused creation and a scrollable form for at-a-glance editing
- Live side-by-side markdown preview with rendered headings, code blocks, tables, checklists, badges, and images
- Template editor for duplicating bundled presets into custom templates with add/remove/reorder of sections, persisted to localStorage
- Real-time quality score that checks for missing title, description, license, installation, usage, and badges
- Markdown import parser that splits an existing README by headings, fuzzy-matches section names to template fields, and populates the editor
- Eleven structured field types (text, textarea, codeblock, list, checklist, table, tags, license, author, badges, images) ensuring correct markdown output for each content shape
- Full undo/redo history, VFS and browser file I/O, clipboard copy, drag-and-drop import, and keyboard shortcuts

### Design Reference
Inspired by web-based README generators such as readme.so and makeareadme.com, combined with the structured template approach of project scaffolding tools like Yeoman and cookiecutter, packaged as a native-feeling desktop application with richer editing controls and offline support.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### Template Selection
- [x] As a user, I can choose from 5 built-in templates (Standard Project, Minimal, Library/Package, CLI Tool, GitHub Profile)
- [x] As a user, I can see each template's name, description, and section count in a card grid
- [x] As a user, I can switch templates at any time and keep data that maps to the new template's sections
- [x] As a user, I can select a template from a toolbar dropdown or the Templates menu
- [x] As a user, I can see the currently active template indicated with a radio check in the Templates menu

### Template Editor
- [x] As a user, I can open a template editor dialog from Templates > Edit Templates
- [x] As a user, I can duplicate any built-in template as a starting point for a custom template
- [x] As a user, I can rename a custom template and change its description
- [x] As a user, I can add new sections to a custom template with a label, type, and required flag
- [x] As a user, I can remove sections from a custom template
- [x] As a user, I can change a section's field type from a dropdown of 11 types
- [x] As a user, I can toggle a section's required flag
- [x] As a user, I can save custom templates to localStorage so they persist across sessions
- [x] As a user, I can delete custom templates (built-in templates cannot be deleted)
- [x] As a user, I can see custom templates listed alongside built-in templates in all selectors

### Wizard Mode
- [x] As a user, I can step through sections one at a time with Back, Next, Skip, and Finish buttons
- [x] As a user, I can see a progress indicator with dots showing completed, current, and remaining steps
- [x] As a user, I can see the step number and total step count
- [x] As a user, I can skip non-required sections
- [x] As a user, I can see each step's section title and a contextual field editor
- [x] As a user, I can see the template selector as the first wizard step

### Form Mode
- [x] As a user, I can see all sections at once in a scrollable form
- [x] As a user, I can collapse and expand individual sections via fieldset headers
- [x] As a user, I can see required sections marked with a badge
- [x] As a user, I can switch between Wizard and Form modes at any time without losing data

### Field Types
- [x] As a user, I can enter a project title in a single-line text input
- [x] As a user, I can write a description in a multi-line textarea
- [x] As a user, I can enter code blocks with a language selector dropdown (17 languages)
- [x] As a user, I can build dynamic lists with add, remove, and inline editing per item
- [x] As a user, I can build checklists with checkboxes and text for roadmap/TODO items
- [x] As a user, I can edit tables with dynamic rows and columns, editable headers and cells
- [x] As a user, I can add tags by typing and pressing Enter, and remove them by clicking the X
- [x] As a user, I can select a license from a dropdown of 8 common licenses or enter custom text
- [x] As a user, I can fill in author fields (name, email, website, GitHub username) as a grouped form
- [x] As a user, I can toggle 35 preset badges across 7 categories (GitHub, CI/Build, Quality, Package Managers, Social, Size & Stats, Support) using visual toggle buttons, fill in user/repo/package context to resolve placeholders, build custom shields.io badges with a live-preview builder (label, message, dual color support for label and message sides, style, logo text input with autocomplete icon grid from the full Simple Icons catalog (~3 400 icons fetched at runtime, 110-icon offline fallback)), use the SZ Color Picker app for precise color selection on all color fields, and set per-badge placeholder overrides (user/repo/package) so sponsorship badges can use different usernames than the global context
- [x] As a user, I can add image URLs with alt text for screenshots

### Live Preview
- [x] As a user, I can see a live-rendered markdown preview in a right-side panel
- [x] As a user, I can resize the splitter between the editor and preview by dragging
- [x] As a user, I can toggle the preview panel on or off via View > Show Preview
- [x] As a user, I can see headings, code blocks, lists, checklists, tables, badges, images, and inline formatting rendered
- [x] As a user, I can see the line count of the generated markdown in the status bar

### Quality Score
- [x] As a user, I can see a quality percentage in the status bar that updates as I edit
- [x] As a user, I can see the number of warnings in the status bar
- [x] As a user, I can hover over the warning count to see individual warning messages
- [x] As a user, I can see warnings for missing title, description, license, installation, usage, and badges
- [x] As a user, I can see warnings for title too long (>50 chars), description too short (<20 chars), and empty placeholder sections
- [x] As a user, I can toggle the quality score panel via View > Show Quality Score

### File Operations
- [x] As a user, I can create a new blank document with File > New (Ctrl+N)
- [x] As a user, I can open a .md file from the VFS with File > Open (Ctrl+O)
- [x] As a user, I can save the current document to VFS with File > Save (Ctrl+S)
- [x] As a user, I can save under a new name with File > Save As
- [x] As a user, I can export the markdown as a browser download with File > Export
- [x] As a user, I can see the dirty/modified state indicated with an asterisk in the title bar

### Import and Parse
- [x] As a user, I can import a .md file from my real filesystem with File > Import File
- [x] As a user, I can paste raw markdown content with File > Paste README and have it parsed into fields
- [x] As a user, I can drag and drop a .md file onto the window to import it
- [x] As a user, I can open files passed via the command line when launched from the desktop
- [x] As a user, I can have the parser extract the title from the first # heading
- [x] As a user, I can have the parser extract the description from text between the title and first ## heading
- [x] As a user, I can have the parser extract badges from [![ patterns
- [x] As a user, I can have the parser fuzzy-match section headings to template fields (e.g., "Getting Started" maps to Installation)

### Clipboard
- [x] As a user, I can copy the full generated markdown to the clipboard with Edit > Copy Markdown (Ctrl+Shift+C)

### Undo and Redo
- [x] As a user, I can undo the last edit with Edit > Undo (Ctrl+Z)
- [x] As a user, I can redo a previously undone edit with Edit > Redo (Ctrl+Y)
- [x] As a user, I can undo up to 50 steps

### Keyboard Shortcuts
- [x] As a user, I can use Ctrl+N to create a new document
- [x] As a user, I can use Ctrl+O to open a file
- [x] As a user, I can use Ctrl+S to save
- [x] As a user, I can use Ctrl+Z/Y for undo/redo
- [x] As a user, I can use Ctrl+Shift+C to copy markdown

### User Interface
- [x] As a user, I can use a menu bar with File, Edit, Templates, View, and Help menus
- [x] As a user, I can use a toolbar with Wizard/Form toggle, template dropdown, Copy MD, and Export buttons
- [x] As a user, I can see an About dialog with application information
- [x] As a user, I can see the current filename and dirty state in the window title

### Aspirational Features
- [ ] As a user, I want to reorder sections via drag handles in the wizard and form
- [ ] As a user, I want to see a review step after import showing which fields were populated
- [ ] As a user, I want to apply a different template to existing data and see a field mapping preview
- [x] As a user, I want to preview badges as rendered images in the editor (not just URLs)
- [ ] As a user, I want to undo/redo per-field rather than global state snapshots
- [ ] As a user, I want to see a diff between my current document and the last saved version
- [ ] As a user, I want to export the README as HTML in addition to markdown
- [ ] As a user, I want to generate a table of contents automatically from section headings
- [ ] As a user, I want to save and load named projects (template + data) to localStorage
- [ ] As a user, I want to import from a GitHub repository URL and auto-detect project metadata
