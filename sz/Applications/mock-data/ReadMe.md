# Mock Data Generator

## Purpose

Comprehensive fake data generator for development and testing. Produces realistic mock data across 10 field type groups in 5 output formats. Configurable field selection with reordering, row count control, and export capabilities.

## How It Works

Users select field types from a categorized list, configure the number of rows (1-10,000), choose an output format, and generate data. Each field type has a dedicated generator function producing realistic fake values. Output is syntax-highlighted and can be copied or exported.

## Architecture

- **`index.html`** -- Menu bar (File/Edit/Help), toolbar, field configuration panel, output preview with syntax highlighting, status bar
- **`controller.js`** -- IIFE with data generator functions, field type registry, output formatters (JSON/CSV/TSV/SQL/XML), clipboard and export operations
- **`styles.css`** -- Split-panel layout, field list, output preview styling
- **Shared modules** -- `menu.js`, `dialog.js`, `syntax-highlighter.js`

## Features

### Field Type Groups (10 groups, 40+ field types)

#### Person
- First Name, Last Name, Full Name, Username, Title (Mr./Mrs./Dr./etc.)

#### Contact
- Email, Phone, Mobile

#### Address
- Street, City, State, Zip Code, Country, Full Address

#### Internet
- URL, Domain, IPv4, IPv6, MAC Address, User Agent

#### Business
- Company Name, Job Title, Department, Catch Phrase

#### Finance
- Credit Card (with Luhn checksum validation), IBAN, BIC/SWIFT, Currency, Price

#### Data
- UUID, Boolean, Integer (configurable range), Float (configurable range), Date, DateTime, Time, Timestamp

#### Text
- Word, Sentence, Paragraph, Lorem Ipsum

#### Color
- Hex Color, RGB, HSL

#### File
- File Name, File Extension, MIME Type, File Path

### Output Formats (5)
- **JSON** -- Array of objects with field names as keys
- **CSV** -- Comma-separated values with header row
- **TSV** -- Tab-separated values with header row
- **SQL** -- INSERT INTO statements with configurable table name
- **XML** -- XML document with root/row/field structure

### Data Generation Features
- Row count: 1 to 10,000
- Auto-increment "id" field option
- Configurable table name for SQL output
- Realistic data patterns (Luhn-valid credit cards, valid-format IBANs, proper UUIDs)
- Randomized but plausible values

### Field Configuration
- Add fields from categorized dropdown
- Remove individual fields
- Reorder fields (move up/down)
- Each field has a configurable label

### Output Features
- Syntax highlighting for generated output
- Copy to clipboard
- Export to file (via SZ VFS or browser download)
- Status bar showing output size and row count

### Integration
- Menu bar with File (New, Generate, Copy, Export, Exit), Edit (Select All), Help (About)
- SZ OS window management (close via menu)
- SZ VFS file export (ComDlg32)
- Syntax highlighter for output preview
- About dialog

## User Stories

- [x] As a developer, I want to generate fake person data so I can populate test databases
- [x] As a developer, I want realistic email addresses and phone numbers so my test data looks authentic
- [x] As a developer, I want valid-format credit card numbers (Luhn checksum) so I can test payment forms
- [x] As a developer, I want UUID generation so I can create test data with unique identifiers
- [x] As a developer, I want to choose how many rows to generate so I can create small or large datasets
- [x] As a developer, I want JSON output so I can use mock data in API testing
- [x] As a developer, I want CSV/TSV output so I can import mock data into spreadsheets
- [x] As a developer, I want SQL INSERT statements so I can populate a database directly
- [x] As a developer, I want XML output so I can test XML-based systems
- [x] As a developer, I want to add and remove fields so I can customize the data schema
- [x] As a developer, I want to reorder fields so the output matches my target schema
- [x] As a developer, I want an auto-increment ID field so I can have sequential primary keys
- [x] As a developer, I want to configure the SQL table name so the output matches my schema
- [x] As a developer, I want to copy output to clipboard so I can paste it where needed
- [x] As a developer, I want to export to a file so I can save large datasets
- [x] As a developer, I want syntax highlighting so the output is easy to read
