# Email Signature Generator

## Purpose

Professional email signature generator with 4 HTML templates, photo upload, social media icon integration, and live preview in a mock email interface. Outputs table-based inline-styled HTML compatible with all major email clients.

## How It Works

A split-pane interface with a form panel on the left (personal info, contact details, photo, social links, accent color) and a live preview on the right rendered inside a mock email chrome. Signatures use HTML tables with inline styles for maximum email client compatibility. Social icons are loaded from the Simple Icons CDN.

## Architecture

- **`index.html`** -- Ribbon UI (Home/Template/View tabs), Quick Access Toolbar, backstage menu, form panel, splitter, preview panel, about dialog
- **`controller.js`** -- IIFE with form data gathering, 4 template generators (table-based HTML), photo handling, clipboard operations, SZ OS integration
- **`styles.css`** -- Split-pane layout, form styling, preview mock email chrome, photo area
- **Shared modules** -- `ribbon.js`, `dialog.js`

## Features

### Templates
- **Classic Horizontal** -- Left-aligned with accent-colored vertical divider, photo on left
- **Modern Vertical** -- Center-aligned with photo, horizontal divider, contact info below
- **Compact Minimal** -- Single-line layout with photo thumbnail, all info condensed
- **Bold with Banner** -- Colored header banner with photo, white contact section below

### Personal Information
- Name, job title, company, department fields
- All fields optional -- signature adapts to what's filled in

### Contact Details
- Email (with mailto: link)
- Phone (with tel: link, auto-strips formatting)
- Mobile (with tel: link)
- Website (auto-prepends https:// if needed)

### Photo
- Upload via file browser, drag-and-drop, or SZ VFS file picker
- Live photo preview with selected frame shape
- 7 frame shapes: Circle, Square, Rounded, Hexagon, Hexagon (flat), Diamond, Octagon
- Implemented via CSS clip-path for exotic shapes
- Remove photo button
- Photo embedded as base64 data URL

### Social Media (14 platforms)
- LinkedIn, Twitter/X, GitHub, Instagram, Facebook, YouTube
- Mastodon, Discord, Stack Overflow, Dribbble, Behance, Medium, Twitch, TikTok
- Icons loaded from Simple Icons CDN with configurable color
- Toggle social icon visibility from View tab

### Accent Color
- Color picker integrated with SZ Desktop color-picker app
- Manual hex input with validation
- Accent color used in template dividers, name, links, and banner

### Export Options
- **Copy HTML** -- Copies table-based HTML to clipboard (with text/html MIME type)
- **Copy Text** -- Copies plain-text version to clipboard
- **Export HTML** -- Downloads or saves complete HTML document via SZ VFS or browser download
- Clipboard fallback for environments without Clipboard API

### UI Features
- Ribbon UI with Home, Template, and View tabs
- Quick Access Toolbar with Copy HTML and Copy Text buttons
- File backstage menu (Copy CSS, Copy HTML, About, Exit)
- Template selection via ribbon radio buttons or form dropdown
- Resizable split pane with draggable splitter (pointer capture)
- Live preview updates on every input change
- Mock email interface with From field

### Integration
- SZ OS window management (close via menu)
- SZ Desktop color-picker app integration via postMessage/localStorage
- SZ VFS file picker for photo browsing (ComDlg32.GetOpenFileName)
- SZ VFS file export (ComDlg32.ExportFile)
- Visual styles injection

## User Stories

### Personal Information
- [x] As a user, I can fill in my name, job title, company, and department so that they appear in my email signature
- [x] As a user, I can leave any field blank and the signature adapts so that only relevant information is shown

### Contact Details
- [x] As a user, I can enter my email address and see it rendered as a mailto: link so that recipients can click to email me
- [x] As a user, I can enter my phone and mobile numbers with auto-formatted tel: links so that recipients can click to call
- [x] As a user, I can enter my website URL with auto-prepended https:// so that the link works correctly

### Templates
- [x] As a user, I can choose from 4 signature templates (Classic Horizontal, Modern Vertical, Compact Minimal, Bold with Banner) so that I can pick a style that matches my brand
- [x] As a user, I can switch templates via the form dropdown or ribbon radio buttons so that selection is convenient
- [x] As a user, I can see the signature use inline styles and HTML tables so that it works in all email clients

### Photo
- [x] As a user, I can upload a photo via file browser, drag-and-drop, or SZ VFS file picker so that my signature includes my headshot
- [x] As a user, I can choose from 7 photo frame shapes (circle, square, rounded, hexagon, hexagon flat, diamond, octagon) so that my photo looks distinctive
- [x] As a user, I can see a live photo preview with the selected frame shape so that I know how it will look
- [x] As a user, I can remove my photo so that I can exclude it from the signature
- [x] As a user, I can toggle photo visibility from the View tab so that I can include or exclude it without deleting it

### Social Media
- [x] As a user, I can add links for 14 social media platforms (LinkedIn, Twitter/X, GitHub, Instagram, Facebook, YouTube, Mastodon, Discord, Stack Overflow, Dribbble, Behance, Medium, Twitch, TikTok) so that recipients can find me online
- [x] As a user, I can see social media icons appear automatically from the Simple Icons CDN so that links are visually recognizable
- [x] As a user, I can toggle social icon visibility from the View tab so that I can show or hide them as needed

### Accent Color
- [x] As a user, I can customize the accent color via a color picker or hex input so that the signature matches my brand colors
- [x] As a user, I can use the SZ Desktop color-picker app integration so that I have a full-featured color selection

### Live Preview
- [x] As a user, I can see a live preview in a mock email interface so that I know exactly how the signature will look
- [x] As a user, I can see the preview update on every input change so that feedback is instant

### Export
- [x] As a user, I can copy the HTML signature to clipboard (with text/html MIME type) so that I can paste it into my email client settings
- [x] As a user, I can copy a plain-text version to clipboard so that I can use it in text-only contexts
- [x] As a user, I can export as a complete HTML document file so that I can save it for later

### User Interface
- [x] As a user, I can use a Ribbon UI with Home, Template, and View tabs so that features are organized
- [x] As a user, I can use a Quick Access Toolbar with Copy HTML and Copy Text buttons so that common actions are one click away
- [x] As a user, I can resize the split pane with a draggable splitter so that I can allocate space between the form and preview
- [x] As a user, I can reset all fields to start fresh so that I can create a new signature from scratch
- [x] As a user, I can see an About dialog via the backstage menu so that I can learn about the application

### Planned Features
- [ ] As a user, I can save and load signature profiles so that I can maintain multiple signatures
- [ ] As a user, I can preview the signature in dark mode so that I can see how it looks on dark email clients
- [ ] As a user, I can add a company logo in addition to a personal photo so that I can include branding
- [ ] As a user, I can add a custom disclaimer or legal text below the signature so that I meet compliance requirements
- [ ] As a user, I can customize the font family used in the signature so that it matches my brand typography
