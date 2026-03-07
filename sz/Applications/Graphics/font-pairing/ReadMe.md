# Font Pairing Tool

## Purpose

Typography exploration tool for discovering complementary font pairs. Features 42 Google Fonts across 5 categories, 25 curated pairings, live preview with adjustable typography settings, and CSS/HTML export.

## How It Works

Loads Google Fonts dynamically via the Google Fonts API. Users select heading and body fonts from dropdowns, browse curated pairs in a categorized sidebar, and preview the combination with editable sample text. Typography settings (size, weight, line-height, letter-spacing) are adjustable via ribbon sliders. Dark mode toggle for contrast testing.

## Architecture

- **`index.html`** -- Ribbon UI (Home/Typography/View tabs), curated pairs sidebar, contenteditable preview area, about dialog
- **`controller.js`** -- IIFE with font registry, curated pair definitions, Google Fonts loading, state management, CSS/HTML generation, clipboard operations
- **`styles.css`** -- Split layout, sidebar, preview area, weight samples
- **Shared modules** -- `ribbon.js`, `dialog.js`

## Features

### Font Collection (42 fonts)
- **Serif**: Playfair Display, Merriweather, Lora, Libre Baskerville, Cormorant Garamond, EB Garamond, Crimson Text, Source Serif 4
- **Sans-serif**: Montserrat, Open Sans, Raleway, Roboto, Poppins, Inter, Work Sans, Nunito, DM Sans, Source Sans 3, Outfit, Manrope, Plus Jakarta Sans, Figtree
- **Monospace**: JetBrains Mono, Fira Code, Source Code Pro, IBM Plex Mono, Space Mono
- **Display**: Abril Fatface, Bebas Neue, Oswald, Anton, Righteous
- **Handwriting**: Dancing Script, Pacifico, Caveat, Satisfy, Great Vibes, Lobster, Sacramento

### Curated Pairs (25 across 5 categories)
- **Classic** -- Traditional serif + sans combinations (e.g., Playfair Display / Source Sans 3)
- **Modern** -- Contemporary sans + sans pairings (e.g., Montserrat / Open Sans)
- **Playful** -- Display/handwriting + sans combinations (e.g., Pacifico / Raleway)
- **Technical** -- Monospace + sans pairings (e.g., JetBrains Mono / Inter)
- **Elegant** -- Refined serif combinations (e.g., Cormorant Garamond / Poppins)

### Typography Controls
- Heading font selector and body font selector
- Heading weight: Regular (400), Medium (500), Bold (700)
- Heading size: 16-72px (slider)
- Body size: 12-24px (slider)
- Line height: 1.0-2.5 (slider)
- Letter spacing: -2px to 5px (slider)

### Preview
- Contenteditable heading and body text areas for custom sample text
- Dark/light mode toggle for contrast testing
- Weight sample strips (Regular 400, Medium 500, Bold 700) with toggle
- Live font application with Google Fonts dynamic loading

### Export
- **Copy CSS** -- Generates @import URL + CSS declarations for heading and body fonts
- **Copy HTML** -- Generates Google Fonts `<link>` tag + HTML sample with inline styles
- Clipboard API with execCommand fallback

### Actions
- **Shuffle** -- Randomly selects a complementary pair from curated list
- **Swap** -- Swaps heading and body fonts

### Integration
- Ribbon UI with Home, Typography, and View tabs
- Quick Access Toolbar with Copy CSS and Copy HTML buttons
- File backstage menu
- SZ OS window management (close via menu)
- About dialog

## User Stories

### Font Browsing and Selection
- [x] As a designer, I can browse 25 curated font pairs across 5 categories so that I can quickly find complementary typography
- [x] As a designer, I can filter curated pairs by category (All, Classic, Modern, Playful, Technical, Elegant) so that I can find pairs matching my project's tone
- [x] As a designer, I can select any heading and body font independently from 42 Google Fonts so that I can create custom combinations
- [x] As a designer, I can click a curated pair in the sidebar to instantly apply it so that I can preview combinations quickly
- [x] As a designer, I can see a thumbnail preview of each pair rendered in its own fonts so that I can visually compare options
- [x] As a designer, I can see the pair's category and mood description so that I can understand the intended aesthetic

### Typography Controls
- [x] As a designer, I can adjust heading font size (16-72px) using a slider so that I can see how the pair works at different scales
- [x] As a designer, I can adjust body font size (12-24px) using a slider so that I can tune body text readability
- [x] As a designer, I can control line height (1.0-2.5) so that I can fine-tune paragraph spacing
- [x] As a designer, I can control letter spacing (-2px to 5px) so that I can adjust character density
- [x] As a designer, I can choose heading font weight (Regular 400, Medium 500, Bold 700) so that I can see how different weights look
- [x] As a designer, I can adjust heading size via the status bar zoom control so that I can change size without opening the ribbon

### Preview
- [x] As a designer, I can see a live preview with editable heading and body text so that I can test with my actual content
- [x] As a designer, I can toggle dark mode so that I can see how the fonts look on dark backgrounds
- [x] As a designer, I can show/hide weight sample strips (Regular 400, Medium 500, Bold 700) so that I can evaluate the heading font across multiple weights
- [x] As a designer, I can see the current font pair name in the status bar so that I know which combination is active

### Actions
- [x] As a designer, I can shuffle for a random curated pair so that I can discover combinations I would not have tried
- [x] As a designer, I can swap heading and body fonts so that I can quickly try the reverse combination

### Export
- [x] As a designer, I can copy CSS with @import URL and font-family declarations so that I can paste it directly into my stylesheet
- [x] As a designer, I can copy HTML with Google Fonts link tag and inline styles so that I can use the fonts in an HTML page
- [x] As a designer, I can see a "Copied!" flash confirmation after copying so that I know the operation succeeded

### User Interface
- [x] As a designer, I can use a ribbon interface with Home, Typography, and View tabs so that I can access all controls from organized panels
- [x] As a designer, I can access Copy CSS and Copy HTML from the Quick Access Toolbar so that I can export without switching tabs
- [x] As a designer, I can see an About dialog with application information

### Aspirational Features
- [ ] As a designer, I want to save favorite font pairs to a personal collection
- [ ] As a designer, I want to see a side-by-side comparison of two different pairings
- [ ] As a designer, I want to load custom fonts from local files for pairing
- [ ] As a designer, I want to preview the font pair applied to a full page layout template
- [ ] As a designer, I want to share a font pair selection via a URL
