# Cookie Banner Generator

A visual cookie consent banner designer with live preview on a simulated webpage. Part of the SynthelicZ desktop environment.

## Purpose

Design and export fully functional cookie consent banners without writing code. The app renders a live preview on a simulated webpage and generates clean, self-contained HTML+CSS+JS ready to paste into any site.

## How It Works

1. Choose a compliance mode (GDPR, CCPA, ePrivacy, Minimal) to set up text, buttons, and cookie categories
2. Pick a design preset or customize colors, spacing, shadows, and animations
3. Preview the banner at different positions, on desktop/mobile viewports, against light/dark backgrounds
4. Manage cookie categories with names, descriptions, and required flags
5. Check WCAG contrast ratios in real time
6. Copy or download the generated code

## User Stories

### Live Preview
- [x] As a user, I can see a live banner preview rendered on a simulated webpage so that I know exactly how my banner will look
- [x] As a user, I can toggle between desktop and mobile viewport (375px) so that I can verify responsive behavior
- [x] As a user, I can toggle between light and dark page backgrounds so that I can test banner appearance against different sites
- [x] As a user, I can replay the banner animation so that I can fine-tune the entrance effect
- [x] As a user, I can drag a splitter between the preview and options panel so that I can allocate screen space to my preference

### Banner Positioning
- [x] As a user, I can place the banner at the bottom bar so that it appears as a full-width footer bar
- [x] As a user, I can place the banner at the top bar so that it appears as a full-width header bar
- [x] As a user, I can place the banner as a center modal so that it demands immediate attention
- [x] As a user, I can place the banner in the bottom-left corner so that it appears as a discrete corner popup
- [x] As a user, I can place the banner in the bottom-right corner so that it appears as a discrete corner popup

### Text Customization
- [x] As a user, I can edit the banner heading text so that it matches my site's tone
- [x] As a user, I can edit the banner body text so that I can explain my cookie policy
- [x] As a user, I can customize button labels (Accept, Reject, Settings) so that they fit my branding
- [x] As a user, I can set a privacy link text and URL so that users can read the full privacy policy
- [x] As a user, I can show or hide the reject button so that I can match my compliance requirements
- [x] As a user, I can show or hide the settings button so that I can control the level of user choice

### Design Customization
- [x] As a user, I can adjust 7 color controls with paired color picker and hex input so that I can match my brand colors
- [x] As a user, I can adjust border radius, font size, padding, and max-width via range sliders so that I can fine-tune the banner style
- [x] As a user, I can choose a shadow level (none/light/medium/heavy) so that I can control the banner's visual depth
- [x] As a user, I can choose a backdrop effect (none/dim/blur) so that I can control how the page behind the banner appears
- [x] As a user, I can choose from 4 animations (slide-up, fade-in, scale-up, none) so that the banner entrance feels polished

### Presets
- [x] As a user, I can apply one of 8 design presets (Minimal Clean, Material, Glassmorphism, Dark Elegant, Corporate Blue, Warm Toast, Neon Accent, Retro Pixel) so that I can quickly get a professional look
- [x] As a user, I can apply one of 4 compliance presets (GDPR, CCPA, ePrivacy, Minimal) so that my text, buttons, and categories match regulatory requirements

### Cookie Categories
- [x] As a user, I can add and remove cookie categories so that I can define what types of cookies my site uses
- [x] As a user, I can set a name and description for each category so that users understand what each category covers
- [x] As a user, I can mark categories as required so that essential cookies cannot be declined

### Accessibility
- [x] As a user, I can see a WCAG 2.1 contrast ratio badge (AAA/AA/AA Large/FAIL) so that I can ensure my banner meets accessibility standards

### Code Export
- [x] As a user, I can view the generated code with syntax highlighting in Combined, HTML, CSS, and JS sub-tabs so that I can inspect each part separately
- [x] As a user, I can copy the generated code to the clipboard so that I can paste it into my project
- [x] As a user, I can download the generated code as an .html file so that I can save it locally
- [x] As a user, I can inject custom CSS so that I can override styles without editing the generated code

### Generated Code Features
- [x] As a user, I can rely on the generated JavaScript using localStorage for consent storage so that consent persists across sessions
- [x] As a user, I can listen for a cookieConsent CustomEvent in the generated code so that my site can react to user consent choices

### State Persistence and Sharing
- [x] As a user, I can have my banner configuration persisted via localStorage so that I can resume editing later
- [x] As a user, I can share my configuration via a URL hash so that others can see my exact setup

### User Interface
- [x] As a user, I can press F1 to open an About dialog so that I can see application information

### Planned Features
- [ ] As a user, I can import existing banner HTML to edit so that I can modify previously created banners
- [ ] As a user, I can choose from additional animation options (bounce, elastic) so that I have more entrance effects
- [ ] As a user, I can preview the banner with RTL language support so that I can verify right-to-left layouts
- [ ] As a user, I can generate a cookie consent analytics dashboard template so that I can track consent rates

## Known Limitations

- The color picker `<input type="color">` does not support alpha/transparency values; semi-transparent colors (like Glassmorphism preset) must be entered as hex text manually
- Generated code uses ES5-compatible JavaScript for broad compatibility
- Syntax highlighting is regex-based and approximate (not a full parser)

## Architecture

Single-page browser app following SZ conventions:

- `index.html` -- Layout with menu bar, toolbar, preview area, splitter, tabbed options panel
- `styles.css` -- Themed CSS using `var(--sz-color-*)` custom properties
- `controller.js` -- IIFE with state management, live preview, code generation, presets, accessibility checker
- `icon.svg` -- Cookie + checkmark app icon

No build step. Works offline from `file://`.
