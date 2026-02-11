# CLAUDE.md — DevToolbox Project Instructions

## Project Overview

We are building **DevToolbox** — a collection of free/freemium web-based developer and designer tools. Each tool is a standalone static website (HTML + CSS + client-side JS) designed to:

- Run 100% in the browser (no backend)
- Be hosted on GitHub Pages (free)
- Generate revenue via ads (phase 1) and freemium upgrades (phase 2)
- Rank on Google for high-volume search terms
- Require near-zero maintenance

This is a monorepo. Each tool lives in its own directory and deploys as its own GitHub Pages site (or subdirectory of one domain).

---

## Tech Stack & Constraints

### Mandatory

- **Pure static sites**: HTML, CSS, vanilla JS (or lightweight framework below)
- **NO backend, NO server, NO database, NO Node.js runtime needed**
- **Hosting**: GitHub Pages — so only static assets
- **Framework (optional)**: Preact + HTM (no build step needed, loaded via CDN) OR plain vanilla JS with Web Components. Prefer vanilla for simplicity.
- **Styling**: Single CSS file per tool using CSS custom properties for theming. No Tailwind (needs build step). Use a shared `common/style.css` base.
- **Build step**: NONE. Every tool must work by opening `index.html` directly. No webpack, no vite, no npm required.
- **Payments (phase 2)**: Stripe Payment Links (no backend needed — just redirect to Stripe-hosted checkout)
- **Analytics**: Plausible Analytics script tag (privacy-friendly, one line) or self-hosted Umami

### Forbidden

- No server-side code
- No Node.js / npm as a runtime dependency
- No build tools required to develop or deploy
- No legal/compliance/financial tools (no invoices, no legal docs, no cookie banners)
- No external API calls that require API keys embedded in client code (security risk)
- Free public APIs only (Google Fonts API, GitHub public API, etc.)

### Allowed External Resources (CDN)

```
- Google Fonts (fonts.googleapis.com)
- cdnjs.cloudflare.com (for small libraries if needed)
- unpkg.com (for small libraries if needed)
- JSZip (for ZIP downloads): https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
- FileSaver.js: https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js
- html2canvas (for screenshot features): https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js
```

---

## Repository Structure

```
devtoolbox/
├── CLAUDE.md                  ← This file (project instructions)
├── README.md                  ← Public repo README
├── index.html                 ← Landing page / tool directory
├── common/
│   ├── style.css              ← Shared base styles + CSS variables
│   ├── components.js          ← Shared JS (theme toggle, nav, analytics, etc.)
│   ├── seo.js                 ← JSON-LD structured data helper
│   └── assets/
│       ├── logo.svg
│       ├── favicon.svg
│       └── og-default.png     ← Default Open Graph image
├── tools/
│   ├── svg-editor/
│   │   ├── index.html
│   │   ├── style.css
│   │   ├── app.js
│   │   ├── og.png             ← Tool-specific OG image
│   │   └── README.md          ← Tool-specific docs
│   ├── favicon-generator/
│   ├── json-converter/
│   ├── css-gradients/
│   ├── color-palette/
│   ├── regex-builder/
│   ├── cron-visualizer/
│   ├── readme-generator/
│   ├── speed-report/
│   ├── mock-data/
│   ├── qr-studio/
│   ├── resume-builder/
│   ├── commit-generator/
│   ├── image-optimizer/
│   ├── email-signature/
│   ├── tailwind-components/
│   ├── subnet-calculator/
│   ├── social-resizer/
│   ├── webhook-tester/        ← Note: this one needs a CF Worker for receiving, mark as Phase 2
│   └── font-pairing/
└── .github/
    └── workflows/
        └── deploy.yml         ← GitHub Actions for Pages deployment (if needed)
```

---

## Shared Design System

### Theme

Dark mode by default (developers prefer it), with light mode toggle.

```css
:root {
  /* Dark theme (default) */
  --bg-primary: #0d1117;
  --bg-secondary: #161b22;
  --bg-card: #1c2128;
  --bg-input: #21262d;
  --border: #30363d;
  --text-primary: #e6edf3;
  --text-secondary: #8b949e;
  --text-muted: #484f58;
  --accent: #58a6ff;
  --accent-hover: #79c0ff;
  --success: #3fb950;
  --warning: #d29922;
  --error: #f85149;
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  --radius: 8px;
  --radius-lg: 12px;
  --shadow: 0 1px 3px rgba(0,0,0,0.3);
}

[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f6f8fa;
  --bg-card: #ffffff;
  --bg-input: #f6f8fa;
  --border: #d0d7de;
  --text-primary: #1f2328;
  --text-secondary: #656d76;
  --text-muted: #8b949e;
  --accent: #0969da;
  --accent-hover: #0550ae;
  --shadow: 0 1px 3px rgba(0,0,0,0.1);
}
```

### Layout Pattern (every tool follows this)

```html
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{Tool Name} — Free Online {Tool Type} | DevToolbox</title>
  <meta name="description" content="{60-160 char SEO description}">
  <meta property="og:title" content="{Tool Name} — DevToolbox">
  <meta property="og:description" content="{Description}">
  <meta property="og:image" content="og.png">
  <meta property="og:type" content="website">
  <link rel="canonical" href="https://{domain}/tools/{tool-slug}/">
  <link rel="icon" href="../../common/assets/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../../common/style.css">
  <link rel="stylesheet" href="style.css">
  <!-- JSON-LD structured data for SEO -->
  <script type="application/ld+json">{...}</script>
</head>
<body>
  <header class="toolbar">
    <a href="/" class="logo">🧰 DevToolbox</a>
    <nav class="tool-nav"><!-- breadcrumb: Home > Tool Name --></nav>
    <button id="theme-toggle" aria-label="Toggle theme">🌙</button>
  </header>

  <main class="tool-container">
    <section class="tool-hero">
      <h1>{Tool Name}</h1>
      <p class="subtitle">{One-line description}</p>
    </section>

    <section class="tool-workspace">
      <!-- TOOL-SPECIFIC UI GOES HERE -->
    </section>
  </main>

  <footer class="site-footer">
    <p>Made with ☕ — <a href="/">More free tools</a></p>
    <!-- SEO: FAQ section with schema markup -->
    <details class="faq"><summary>What is {tool}?</summary><p>...</p></details>
    <details class="faq"><summary>Is it free?</summary><p>...</p></details>
    <details class="faq"><summary>Is my data safe?</summary><p>Everything runs in your browser. We never upload or store your files.</p></details>
  </footer>

  <script src="../../common/components.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

### UX Principles

1. **No signup wall.** Tool works immediately. No modals, no email gates.
2. **Input on the left (or top), output on the right (or bottom).** Always.
3. **One primary action button**, visually dominant. (e.g., "Generate", "Convert", "Download")
4. **Drag & drop** for any file input. Always also provide a browse button and paste support.
5. **Instant feedback** — no loading screens for client-side operations. Use Web Workers for heavy computation.
6. **Copy to clipboard** button on all text outputs. Show a ✓ checkmark for 2 seconds after copying.
7. **Mobile responsive.** Stack side-by-side panels vertically on mobile.
8. **Privacy badge**: Small text near file inputs: "🔒 Files never leave your browser"

---

## SEO Strategy (Critical for Every Tool)

Each tool page MUST include:

1. **Title tag**: `{Primary Keyword} — Free Online Tool | DevToolbox` (under 60 chars)
2. **Meta description**: Action-oriented, includes keyword, under 160 chars
3. **H1**: Contains primary keyword naturally
4. **FAQ section** at bottom (3-5 questions) with `<details>` + FAQ schema markup
5. **JSON-LD** WebApplication structured data
6. **Canonical URL**
7. **OG image** (tool-specific, 1200x630, shows the tool UI or a visual result)
8. **Internal links** to other tools in the footer ("You might also like...")
9. **Fast load**: Target < 100KB total page weight (excluding user content). No heavy frameworks.
10. **Semantic HTML**: proper heading hierarchy, aria labels, alt texts

### Target Keywords per Tool

| Tool | Primary Keyword | Monthly Searches (est.) |
|------|----------------|------------------------|
| svg-editor | svg editor online | 400K |
| favicon-generator | favicon generator | 600K |
| json-converter | json to csv converter | 1.2M |
| css-gradients | css gradient generator | 1.5M |
| color-palette | color palette generator | 1.2M |
| regex-builder | regex tester | 1M |
| cron-visualizer | crontab guru / cron expression | 800K |
| readme-generator | readme generator | 200K |
| mock-data | fake data generator | 300K |
| qr-studio | qr code generator | 5M |
| resume-builder | markdown resume builder | 150K |
| image-optimizer | image compressor online | 3M |
| email-signature | email signature generator | 300K |
| tailwind-components | tailwind components free | 400K |
| subnet-calculator | subnet calculator | 800K |
| social-resizer | instagram image size | 500K |
| font-pairing | font pairing tool | 300K |
| commit-generator | git commit message | 200K |
| speed-report | website speed test | 2M |
| webhook-tester | webhook tester | 500K |

---

## Build Order (Priority)

Build in this order based on: search volume × low effort × high standalone value.

### Phase 1 — Quick Wins (build these first, 1-2 days each)

1. **qr-studio** — 5M searches, dead simple, Canvas API
2. **css-gradients** — 1.5M searches, pure CSS rendering, zero complexity
3. **color-palette** — 1.2M searches, just color math
4. **json-converter** — 1.2M searches, parsing + formatting
5. **regex-builder** — 1M searches, built-in regex engine

### Phase 2 — Medium Effort (2-3 days each)

6. **image-optimizer** — 3M searches, needs WASM codecs
7. **favicon-generator** — 600K searches, Canvas for icon generation
8. **font-pairing** — 500K searches, Google Fonts integration
9. **cron-visualizer** — 800K searches, date math + visualization
10. **subnet-calculator** — 800K searches, binary math

### Phase 3 — Polish & Expand (3-5 days each)

11. **svg-editor** — 400K searches, SVG DOM manipulation
12. **email-signature** — 300K searches, cross-client HTML tables
13. **social-resizer** — 500K searches, Canvas image manipulation
14. **mock-data** — 300K searches, data generation algorithms
15. **tailwind-components** — 400K searches, curated component library

### Phase 4 — Advanced

16. **resume-builder** — PDF generation client-side
17. **readme-generator** — GitHub API integration
18. **commit-generator** — needs client-side LLM or limited free API
19. **speed-report** — PageSpeed Insights API (free but rate-limited)
20. **webhook-tester** — needs Cloudflare Worker (not pure static, defer)

---

## Detailed Specs per Tool

### 1. qr-studio (QR Code Studio)

**File**: `tools/qr-studio/`

**Features (MVP)**:
- Text input: URL, plain text, WiFi credentials, vCard, email, phone, WhatsApp link
- QR generation using `qrcode-generator` algorithm (port to vanilla JS or use https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js)
- Style options:
  - Foreground/background color pickers
  - Dot style: squares, rounded, dots, diamond
  - Corner style: square, rounded, extra-rounded
  - Center logo upload (overlay on QR with quiet zone)
  - Gradient fills (linear/radial on foreground)
- Output: Download as PNG (Canvas.toBlob), SVG, or PDF
- Size selector: 256px, 512px, 1024px, 2048px
- Error correction level selector: L, M, Q, H
- Live preview updates as user types/changes settings

**Features (Pro — Phase 2)**:
- Batch generation (CSV upload → ZIP of QR codes)
- Dynamic QR (redirect URL, requires backend → defer)
- Scan analytics (requires backend → defer)
- Remove "Made with DevToolbox" watermark

**Key implementation details**:
- QR encoding: Use a client-side QR code library. Encode data → get module matrix → render to Canvas with custom styling
- For dot styles: iterate over the module matrix, draw each module as the chosen shape (rect, circle, roundedRect, diamond)
- Logo overlay: draw logo image centered on canvas after QR, ensure enough error correction (force H level when logo is used)
- SVG export: build SVG string from the same module matrix

**SEO**:
- Title: "QR Code Generator — Free, Custom Styled | DevToolbox"
- H1: "Free QR Code Generator with Custom Styles"
- FAQs: What is a QR code? Can I add a logo? What's error correction? Are QR codes free?

---

### 2. css-gradients (CSS Gradient Studio)

**File**: `tools/css-gradients/`

**Features (MVP)**:
- Gradient types: linear, radial, conic
- Color stop editor: add/remove/reorder stops, pick colors, adjust positions
- Angle/position control for each type
- Live preview: large preview box + small tile showing repeat
- One-click copy CSS (show the actual `background:` property)
- Export as: raw CSS, CSS custom property, Tailwind arbitrary value, PNG image (Canvas), SVG
- Gallery: 200+ preset gradients (stored as JSON array in a separate file)
  - Categories: warm, cool, pastel, dark, neon, nature, sunset, metallic
  - Each preset: { name, css, tags }
- Mesh gradient generator: 4-point mesh with draggable control points
- Noise/grain texture overlay (CSS filter or SVG filter)
- Glassmorphism generator: background blur + transparency + border

**Features (Pro)**:
- Save favorites (localStorage for free, cloud sync for pro)
- Animated gradients (CSS animation + @keyframes generation)
- Export for Figma/Sketch

**Implementation**:
- Gradient editor: HTML range inputs + color inputs → compose CSS string → apply to preview div
- Mesh gradient: use multiple radial-gradient layers positioned at drag points
- Noise: SVG `<feTurbulence>` filter applied via CSS
- Gallery: load presets from JSON, render as clickable grid, clicking applies to editor
- Copy: use `navigator.clipboard.writeText()`

**SEO**:
- Title: "CSS Gradient Generator — Linear, Radial, Mesh | DevToolbox"
- H1: "Free CSS Gradient Generator"

---

### 3. color-palette (Color Palette Generator)

**File**: `tools/color-palette/`

**Features (MVP)**:
- Input: one hex/rgb/hsl color (text input + visual picker)
- Generate:
  - Shades (darker variations, 5-10 steps)
  - Tints (lighter variations, 5-10 steps)
  - Complementary color
  - Analogous (±30°)
  - Triadic (120° apart)
  - Split-complementary
  - Tetradic / Square
- Each color shows: hex, rgb, hsl, oklch values. Click to copy.
- Contrast checker: show WCAG AA/AAA compliance for text on each color
- Export: CSS variables, SCSS variables, Tailwind config object, JSON, PNG palette image
- Randomize button: generate a random starting color
- Extract palette from image: upload image → extract dominant 5 colors (using Canvas getImageData + k-means)

**Implementation**:
- All color math in HSL space: hue rotation for harmonies, lightness scaling for shades/tints
- Convert between hex ↔ rgb ↔ hsl ↔ oklch using standard formulas
- WCAG contrast: calculate relative luminance, compute ratio
- Image extraction: draw image to hidden Canvas, sample pixels, run simple k-means clustering (k=5)
- Export Tailwind: format as `{ colors: { primary: { 50: '#...', 100: '#...', ... 900: '#...' } } }`

---

### 4. json-converter (JSON/CSV/XML Swiss Army Knife)

**File**: `tools/json-converter/`

**Features (MVP)**:
- Input: paste text or drag & drop file
- Auto-detect format (JSON, CSV, XML, YAML, TOML)
- Convert to any other format
- JSON tools: prettify, minify, validate, sort keys, flatten/unflatten, diff two JSONs
- CSV tools: preview as table, change delimiter, quote handling
- Generate TypeScript interfaces from JSON
- Generate JSON Schema from JSON
- Tree view for nested JSON (collapsible)
- File size display + line count

**Implementation**:
- JSON: built-in `JSON.parse/stringify`
- CSV: custom parser (handle quoted fields, newlines in values, different delimiters)
- XML: use `DOMParser` built into browsers
- YAML: use js-yaml from CDN (https://cdnjs.cloudflare.com/ajax/libs/js-yaml/4.1.0/js-yaml.min.js)
- TypeScript generation: recursive type inference from JSON values
- Diff: line-by-line comparison, highlight additions/deletions
- Use Web Worker for large file processing (>1MB)

---

### 5. regex-builder (Regex Builder & Tester)

**File**: `tools/regex-builder/`

**Features (MVP)**:
- Regex input with syntax highlighting
- Test string input (multi-line)
- Live match highlighting in test string
- Match details panel: groups, indices, captures
- Flags toggles: g, i, m, s, u, d (visual checkboxes)
- Visual regex breakdown: explain each part in plain English
  - e.g., `\d{2,4}` → "2 to 4 digits"
  - Build a regex→English parser (map patterns to descriptions)
- Common regex library: email, URL, phone (DE/US/intl), IP, date formats, etc.
- Share via URL: encode regex + flags + test string in URL hash
- Cheatsheet sidebar: collapsible reference of regex syntax

**Implementation**:
- Use native `RegExp` for matching
- Syntax highlighting: parse regex tokens, wrap in colored spans
- Explanation: recursive descent parser for regex syntax → generate English descriptions
- URL sharing: `#regex=...&flags=...&test=...` using encodeURIComponent
- Cheatsheet: static HTML, toggled with CSS

---

## Landing Page (index.html)

The root `index.html` is the tool directory / landing page.

**Sections**:
1. Hero: "Free Developer & Design Tools — No Signup, No Upload, No BS"
2. Tool grid: card for each tool (icon, name, one-liner, link)
   - Cards grouped by category
   - Search/filter bar
3. "Why DevToolbox?" section:
   - 🔒 Everything runs in your browser
   - ⚡ No signup required
   - 💸 Free forever (pro upgrades optional)
   - 🌍 Works offline (service worker — Phase 2)
4. Footer with GitHub link, about, etc.

---

## GitHub Pages Deployment

### Option A: Single repo, one domain

- Repo: `username.github.io` (or custom domain via CNAME)
- All tools under `/tools/{name}/`
- GitHub Pages serves from root of `main` branch

### Option B: Separate repos per tool (more complex, skip for now)

**Go with Option A.** Single repo, single domain, all tools as subdirectories.

### Custom domain setup (when ready)

1. Buy domain (e.g., `devtoolbox.dev` or `toolbox.dev` — check availability)
2. Add CNAME file to repo root
3. Configure DNS A/AAAA records pointing to GitHub Pages IPs
4. Enable HTTPS in repo settings

---

## Development Workflow

### For Claude Code CLI

When building a tool:

1. Create the tool directory: `tools/{tool-name}/`
2. Create `index.html` following the shared layout template above
3. Create `style.css` for tool-specific styles (import common vars)
4. Create `app.js` with the tool logic
5. Ensure the tool works by opening `index.html` in a browser directly (file:// protocol should work, but relative paths to common/ must be correct)
6. Add the tool to the landing page grid in root `index.html`
7. Test: all functionality works with no console errors, responsive on mobile, dark/light theme works

### Code Quality Rules

- Use `'use strict';` at top of every JS file
- Use `const` and `let`, never `var`
- Use template literals for HTML generation
- Use event delegation where possible
- All user-facing strings should be in English
- Handle edge cases: empty input, huge files (>10MB → warn user), invalid formats
- No `alert()` — use inline error messages styled consistently
- Console should be clean: no leftover `console.log` in production

### Accessibility

- All interactive elements must be keyboard accessible
- Use semantic HTML (`<button>` not `<div onclick>`)
- Color pickers must also accept text input (not just visual)
- Maintain 4.5:1 contrast ratio for text
- Use `aria-label` for icon-only buttons

---

## Revenue Integration (Phase 2 — don't build yet, just leave hooks)

### Ad Placement (Phase 2a)

- One ad slot below the tool output area (never interrupt the workflow)
- One ad slot in the sidebar on desktop (if layout allows)
- Use `<div id="ad-slot-1" class="ad-container"></div>` as placeholder
- Class `.ad-container` should have `min-height: 90px; background: var(--bg-secondary);` as placeholder

### Stripe Payment Links (Phase 2b)

- "Upgrade to Pro" button in the tool header (subtle, not aggressive)
- Links to Stripe-hosted checkout page (no backend needed)
- Pro features gated with a simple `localStorage` flag (honor system initially, proper auth later)
- `common/components.js` should include a `checkPro()` function that reads `localStorage.getItem('pro')`

---

## File Naming Conventions

- HTML: `index.html` (always, for clean URLs)
- CSS: `style.css` (tool-specific), `../../common/style.css` (shared)
- JS: `app.js` (main tool logic), additional modules as `{feature}.js`
- Images: lowercase, hyphens, descriptive: `gradient-preview.png`, `og.png`
- No spaces, no uppercase in filenames

---

## Quick Start for Claude Code

To start building, run these commands:

```bash
# Create the project structure
mkdir -p devtoolbox/{common/assets,tools,.github/workflows}
cd devtoolbox
git init

# Start with Phase 1, Tool 1: QR Studio
# Build common/style.css first (shared theme)
# Build common/components.js (theme toggle, nav, copy helper)
# Build tools/qr-studio/ (first tool)
# Build index.html (landing page)
# Then proceed to next tool in Phase 1
```

When I say "build tool X", follow this sequence:
1. Read this CLAUDE.md for the spec
2. Create the 3 files (index.html, style.css, app.js) in the tool directory
3. Follow the shared layout template
4. Implement all MVP features listed in the spec
5. Test it works standalone
6. Add it to the landing page
