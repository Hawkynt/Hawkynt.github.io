# Cron Visualizer

A tool for building, inspecting, and explaining crontab entries within the »SynthelicZ« desktop. It parses full crontab files, shows human-readable schedule meanings, computes upcoming execution times, and provides a visual builder for constructing new cron expressions.

## Product Requirements

### Purpose
The Cron Visualizer helps »SynthelicZ« desktop users understand, build, and debug crontab schedules without needing a terminal or external reference. It translates cryptic cron syntax into plain-language descriptions and future run times, making it invaluable for system administrators, developers, and anyone working with scheduled tasks.

### Key Capabilities
- Full crontab file parsing with structured output showing line numbers, expressions, commands, and human-readable meanings
- Next-run-time computation showing the upcoming 4 execution times for each entry
- Interactive expression builder with individual fields for minute, hour, day-of-month, month, and day-of-week
- Support for all standard cron syntax including wildcards, lists, ranges, steps, names, and special schedules (@yearly, @reboot, etc.)
- Environment variable recognition and error highlighting for invalid entries
- Quick reference panel for cron syntax symbols, month/weekday names, and special keywords
- File open/save operations with dirty-state tracking

### Design Reference
Modeled after online cron expression explainers such as crontab.guru, combined with a crontab file editor similar to the output of `crontab -e`, brought together into a single desktop application.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### Core Functionality
- [x] As a user, I can enter crontab text in a multi-line editor
- [x] As a user, I can parse the crontab and see all entries in a structured table
- [x] As a user, I can see each entry's line number, schedule expression, command, and human-readable meaning
- [x] As a user, I can see the next 4 computed run times for each entry
- [x] As a user, I can see environment variable assignments recognized and displayed separately
- [x] As a user, I can see invalid entries highlighted as errors with descriptive error messages
- [x] As a user, I can see the entry count in the status bar

### Cron Expression Support
- [x] As a user, I can use standard 5-field cron expressions (minute, hour, day-of-month, month, day-of-week)
- [x] As a user, I can use wildcard (*) for any value
- [x] As a user, I can use comma-separated lists (e.g., 1,3,5)
- [x] As a user, I can use ranges (e.g., 1-5)
- [x] As a user, I can use step values (e.g., */15, 1-10/2)
- [x] As a user, I can use month names (jan-dec) and weekday names (sun-sat)
- [x] As a user, I can use special schedules (@yearly, @monthly, @weekly, @daily, @hourly, @reboot)

### Expression Builder
- [x] As a user, I can build a cron expression using individual input fields for minute, hour, day-of-month, month, and day-of-week
- [x] As a user, I can enter a command to associate with the built expression
- [x] As a user, I can preview the built expression with its meaning and next run times
- [x] As a user, I can append the built expression to the crontab editor
- [x] As a user, I can see the preview update live as I modify builder fields

### Quick Reference
- [x] As a user, I can see a quick reference panel explaining cron syntax symbols (*, comma, range, step)
- [x] As a user, I can see month and weekday name references
- [x] As a user, I can see special schedule keywords listed

### File Operations
- [x] As a user, I can open a crontab file from the filesystem
- [x] As a user, I can save the current crontab text as a file
- [x] As a user, I can clear all entries and start fresh
- [x] As a user, I can open files passed via the command line when launched from the desktop
- [x] As a user, I can see the current filename in the status bar with a dirty indicator

### User Interface
- [x] As a user, I can use a menu bar with File, Edit, and Help menus
- [x] As a user, I can use a toolbar with quick-access buttons for open, save, parse, clear, and append
- [x] As a user, I can see a status message indicating the last action performed
- [x] As a user, I can see an About dialog with application information
- [x] As a user, I can open a crontab reference link in the browser

### Keyboard Shortcuts
- [x] As a user, I can use Ctrl+O to open a file
- [x] As a user, I can use Ctrl+S to save
- [x] As a user, I can use Ctrl+Enter to parse the crontab
- [x] As a user, I can use Escape to close dialogs and menus

### Aspirational Features
- [ ] As a user, I want to see a timeline/heatmap visualization of when jobs will run throughout a day/week
- [ ] As a user, I want to see overlapping schedule conflicts highlighted
- [ ] As a user, I want to click on a parsed entry row to load it back into the builder for editing
- [ ] As a user, I want to validate that commands referenced in entries exist in the filesystem
- [ ] As a user, I want to see a calendar view highlighting days when specific jobs will run
- [ ] As a user, I want to export the parsed schedule as a JSON or CSV file
- [ ] As a user, I want to receive warnings about common cron pitfalls (e.g., running every second)
- [ ] As a user, I want to diff two crontab files and see added/removed/changed entries
