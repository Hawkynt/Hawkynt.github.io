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

### Data Generation
- [x] As a developer, I can generate fake person data (first name, last name, full name, username, title) so that I can populate test databases
- [x] As a developer, I can generate realistic contact data (email, phone, mobile) so that my test data looks authentic
- [x] As a developer, I can generate address data (street, city, state, zip, country, full address) so that I can test location-based features
- [x] As a developer, I can generate internet data (URL, domain, IPv4, IPv6, MAC address, user agent) so that I can test network-related features
- [x] As a developer, I can generate business data (company name, job title, department, catch phrase) so that I can populate corporate test scenarios
- [x] As a developer, I can generate finance data with valid-format credit card numbers (Luhn checksum), IBAN, BIC/SWIFT, currency, and price so that I can test payment forms
- [x] As a developer, I can generate data types (UUID, boolean, integer, float, date, datetime, time, timestamp) so that I can create typed test data
- [x] As a developer, I can generate text data (word, sentence, paragraph, Lorem Ipsum) so that I can fill content areas
- [x] As a developer, I can generate color data (hex, RGB, HSL) so that I can test design-related features
- [x] As a developer, I can generate file data (file name, extension, MIME type, file path) so that I can test file system features

### Configuration
- [x] As a developer, I can choose how many rows to generate (1 to 10,000) so that I can create small or large datasets
- [x] As a developer, I can add and remove fields from a categorized dropdown so that I can customize the data schema
- [x] As a developer, I can reorder fields (move up/down) so that the output matches my target schema
- [x] As a developer, I can configure each field's label so that column names match my requirements
- [x] As a developer, I can enable an auto-increment ID field so that I can have sequential primary keys
- [x] As a developer, I can configure the SQL table name so that the output matches my database schema

### Output Formats
- [x] As a developer, I can generate JSON output so that I can use mock data in API testing
- [x] As a developer, I can generate CSV output so that I can import mock data into spreadsheets
- [x] As a developer, I can generate TSV output so that I can import data into tab-separated tools
- [x] As a developer, I can generate SQL INSERT statements so that I can populate a database directly
- [x] As a developer, I can generate XML output so that I can test XML-based systems

### Export and Clipboard
- [x] As a developer, I can copy output to clipboard so that I can paste it where needed
- [x] As a developer, I can export to a file (via SZ VFS or browser download) so that I can save large datasets
- [x] As a developer, I can see syntax highlighting on the output so that it is easy to read
- [x] As a developer, I can see output size and row count in the status bar so that I know the result dimensions

### User Interface
- [x] As a developer, I can use a menu bar with File (New, Generate, Copy, Export, Exit), Edit (Select All), and Help (About) so that all operations are accessible
- [x] As a developer, I can see an About dialog with application information so that I know the app version

### Planned Features
- [ ] As a developer, I can define custom field generators with a formula or pattern so that I can create domain-specific data
- [ ] As a developer, I can save and load field configurations so that I can reuse schemas across sessions
- [ ] As a developer, I can generate related data across tables (foreign keys) so that I can create relational test datasets
- [ ] As a developer, I can set a seed for reproducible random data so that I can recreate the same dataset
- [ ] As a developer, I can preview the first few rows before generating the full dataset so that I can verify the schema is correct
