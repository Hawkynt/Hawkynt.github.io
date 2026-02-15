# Regex Tester

A real-time regular expression development environment within the »SynthelicZ« desktop, with match highlighting, capture group inspection, pattern explanation, substitution preview, and a comprehensive quick-reference sidebar for crafting and testing regex patterns.

## Product Requirements

### Purpose
The Regex Tester provides an interactive regular expression workbench within the »SynthelicZ« desktop, letting developers and power users build, test, and debug regex patterns with instant visual feedback. It solves the common need for a local, offline-capable regex tool that shows matches, capture groups, and substitution results in real time without relying on external web services.

### Key Capabilities
- Real-time pattern matching with inline highlighting over multi-line test strings
- Capture group inspection with named group support and color coding
- Live substitution/replace preview with backreference support
- Tokenized plain-language pattern explanation
- Collapsible quick-reference sidebar covering characters, quantifiers, groups, anchors, and flags
- Common patterns library with one-click loading of pre-built regex for emails, URLs, IPs, etc.
- Pattern history persisted to localStorage and URL-based state sharing
- Multi-format export (JavaScript, Python, Java, C#, Perl regex literals) and CSV/TSV match table export

### Design Reference
Inspired by online regex testers like regex101.com and RegExr, combining a pattern input, test string area with match overlay, and a reference/history sidebar in a single-page layout.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### Pattern Input
- [x] As a user, I can type a regex pattern into a dedicated input field
- [x] As a user, I can see the pattern displayed in /pattern/flags notation
- [x] As a user, I can toggle regex flags individually: global (g), ignore case (i), multiline (m), dotAll (s), unicode (u)
- [x] As a user, I can see the current flags displayed next to the pattern
- [x] As a user, I can see syntax errors immediately when my pattern is invalid
- [ ] As a user, I can use autocomplete suggestions for common regex tokens
- [ ] As a user, I can see a visual regex railroad diagram for my pattern

### Test String
- [x] As a user, I can enter a multiline test string in a textarea
- [x] As a user, I can see line numbers displayed alongside the test string
- [x] As a user, I can see matches highlighted inline over the test string in real time
- [x] As a user, I can scroll the test string and see highlights remain synchronized
- [ ] As a user, I can load test strings from a file

### Match Details
- [x] As a user, I can see the total match count displayed
- [x] As a user, I can see each match listed with its matched text, position (start-end), and capture groups
- [x] As a user, I can see named capture groups identified by name and index
- [x] As a user, I can see capture groups color-coded for easy identification
- [x] As a user, I can see "No matches found" when the pattern produces no results
- [x] As a user, I can see matches displayed in a tabular view with one row per match and one column per capture group
- [x] As a user, I can see the match table with columns for Match number, Position, Full Match, and each capture group
- [x] As a user, I can see group column headers color-coded to match the capture group colors
- [ ] As a user, I can click on a match in the detail panel to highlight and scroll to it in the test string

### Substitution / Replace Preview
- [x] As a user, I can enter a replacement/substitution pattern
- [x] As a user, I can see a live preview of the replacement result
- [x] As a user, I can use backreferences ($1, $2, etc.) in the replacement pattern
- [ ] As a user, I can copy the replacement result to the clipboard

### Pattern Explanation
- [x] As a user, I can see a tokenized explanation of my regex pattern below the test area
- [x] As a user, I can see each regex token (e.g., \\d, *, [abc], (?=...)) described in plain language
- [x] As a user, I can see escaped characters, character classes, groups, quantifiers, and anchors explained
- [ ] As a user, I can hover over a token in the explanation to highlight the corresponding part of the pattern

### Quick Reference Sidebar
- [x] As a user, I can see a collapsible sidebar with regex reference sections (Characters, Quantifiers, Groups, Anchors, Flags)
- [x] As a user, I can toggle each reference section open or closed
- [x] As a user, I can see code examples with descriptions for each regex concept
- [ ] As a user, I can click on a reference item to insert it into the pattern input

### Common Patterns
- [x] As a user, I can see a library of common patterns (Email, URL, Phone, IPv4, Date, Hex Color, HTML Tag, Integer, Float, Word)
- [x] As a user, I can click a common pattern to load it with appropriate flags and sample test text
- [ ] As a user, I can add my own custom patterns to the common patterns library

### Copy As (Export)
- [x] As a user, I can copy the pattern as a JavaScript regex literal (/pattern/flags)
- [x] As a user, I can copy the pattern as a Python raw string (r"pattern")
- [x] As a user, I can copy the pattern as a Java string with escaped backslashes
- [x] As a user, I can copy the pattern as a C# verbatim string with RegexOptions
- [x] As a user, I can copy the pattern as a Perl qr// literal with flags
- [x] As a user, I can export the match table as CSV to the clipboard
- [x] As a user, I can export the match table as TSV to the clipboard
- [ ] As a user, I can copy the pattern in additional language formats (Go, Ruby, PHP)

### Pattern History
- [x] As a user, I can see a history of previously used patterns saved to localStorage
- [x] As a user, I can click a history entry to reload it into the pattern input
- [x] As a user, I can delete individual history entries
- [x] As a user, I can see history persists across sessions (up to 20 entries)
- [x] As a user, I can see patterns auto-saved to history when the input loses focus
- [ ] As a user, I can clear all history at once

### URL Sharing
- [x] As a user, I can see the current pattern, flags, test string, and substitution encoded into the URL hash
- [x] As a user, I can share the URL to reproduce the exact same regex test state
- [x] As a user, I can load a shared URL and have all fields populated automatically
- [ ] As a user, I can generate a short shareable link

### User Interface
- [x] As a user, I can see a clean layout with pattern input at top, test string and matches in the middle, and explanation below
- [x] As a user, I can see the sidebar on the right for reference and history
- [x] As a user, I can see changes reflected in real time with debounced updates (150ms)
- [x] As a user, I can start with a default example pattern and test string
- [ ] As a user, I can switch between light and dark themes
- [ ] As a user, I can resize the test string area by dragging

### Performance & Safety
- [x] As a user, I can see that infinite-match patterns (empty matches) are handled safely with a 10,000-match limit
- [x] As a user, I can see input changes debounced to avoid excessive re-evaluation
- [ ] As a user, I can see a warning if a pattern has catastrophic backtracking potential
