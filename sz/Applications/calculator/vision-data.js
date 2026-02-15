;(function(){window.__visionMd=`# Calculator

A multi-mode calculator for the »SynthelicZ« desktop -- offering Standard, Scientific, and Programmer modes in a single application, modeled after the classic Windows Calculator with full keyboard support and a familiar menu-driven mode switcher.

## Product Requirements

### Purpose
Calculator provides essential mathematical computation capabilities within the »SynthelicZ« desktop, covering everyday arithmetic, advanced scientific functions, and programmer-oriented bitwise and base-conversion operations. It serves as a general-purpose calculation tool that users expect to find in any desktop environment.

### Key Capabilities
- Standard mode with basic arithmetic, percentage, square root, reciprocal, and memory operations
- Scientific mode with trigonometric, logarithmic, exponential, and factorial functions plus parentheses
- Programmer mode with hex/dec/oct/bin base switching, bitwise operations, word size selection, and interactive bit display
- Full keyboard input mapping for digits, operators, and mode-specific keys
- Menu-driven mode switching with automatic window resizing
- Auto-shrinking display with exponential notation for extreme values

### Design Reference
Modeled after the classic Windows Calculator (calc.exe) from Windows XP, which provides Standard and Scientific modes with a simple menu bar for switching, extended here with a Programmer mode similar to that introduced in Windows 7/10 Calculator.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### Standard Mode

- [x] As a user, I can enter digits (0-9) using on-screen buttons or the keyboard
- [x] As a user, I can enter a decimal point for floating-point numbers
- [x] As a user, I can perform basic arithmetic: addition, subtraction, multiplication, and division
- [x] As a user, I can press equals (= or Enter) to evaluate the pending operation
- [x] As a user, I can chain multiple operations in sequence
- [x] As a user, I can calculate percentages relative to the accumulator
- [x] As a user, I can calculate square roots
- [x] As a user, I can calculate reciprocals (1/x)
- [x] As a user, I can negate the current value (plus/minus toggle)
- [x] As a user, I can press C to clear all state (value, operator, accumulator)
- [x] As a user, I can press CE to clear only the current entry
- [x] As a user, I can press Backspace to delete the last digit
- [x] As a user, I can see "Error" displayed for invalid operations (division by zero, sqrt of negative)

### Memory Operations

- [x] As a user, I can store the current value in memory (MS)
- [x] As a user, I can recall the stored memory value (MR)
- [x] As a user, I can add the current value to memory (M+)
- [x] As a user, I can subtract the current value from memory (M-)
- [x] As a user, I can clear memory (MC)

### Scientific Mode

- [x] As a user, I can switch to Scientific mode via the View menu
- [x] As a user, I can see the window resize to accommodate the wider scientific button layout
- [x] As a user, I can toggle between degrees and radians for trigonometric functions
- [x] As a user, I can calculate sin, cos, and tan of the current value
- [x] As a user, I can calculate inverse trig functions: asin, acos, atan
- [x] As a user, I can calculate log (base 10) and natural log (ln)
- [x] As a user, I can calculate e^x and 10^x
- [x] As a user, I can calculate x squared, x cubed, and x^y (arbitrary power)
- [x] As a user, I can calculate cube roots and y-th roots
- [x] As a user, I can calculate absolute value
- [x] As a user, I can calculate factorials (n!) for non-negative integers up to 170
- [x] As a user, I can insert the constant pi
- [x] As a user, I can insert Euler's number (e)
- [x] As a user, I can use parentheses for expression grouping
- [x] As a user, I can use the modulo (mod) operator

### Programmer Mode

- [x] As a user, I can switch to Programmer mode via the View menu
- [x] As a user, I can see the window resize to accommodate the programmer layout
- [x] As a user, I can switch between HEX, DEC, OCT, and BIN number bases
- [x] As a user, I can see the current value simultaneously displayed in all four bases
- [x] As a user, I can enter hex digits (A-F) when in hexadecimal base
- [x] As a user, I can see digit buttons disabled when they are invalid for the current base
- [x] As a user, I can select word size: BYTE (8-bit), WORD (16-bit), DWORD (32-bit), or QWORD (64-bit)
- [x] As a user, I can see values clamped and displayed according to the selected word size with two's complement
- [x] As a user, I can perform bitwise AND, OR, NOT, XOR operations
- [x] As a user, I can perform NAND, NOR operations
- [x] As a user, I can perform left shift (LSH) and right shift (RSH) operations
- [x] As a user, I can perform rotate left (ROL) and rotate right (ROR) operations
- [x] As a user, I can see a visual bit display showing individual bits grouped in nibbles
- [x] As a user, I can click individual bits in the bit display to toggle them
- [x] As a user, I can see the decimal point and percent buttons disabled in Programmer mode

### Mode Switching

- [x] As a user, I can switch modes via the View menu (Standard, Scientific, Programmer)
- [x] As a user, I can see the displayed value preserved when switching between modes
- [x] As a user, I can see the window title update to reflect the current mode
- [x] As a user, I can see the checked radio indicator on the active mode in the View menu

### Display

- [x] As a user, I can see the display auto-shrink its font size to fit long numbers
- [x] As a user, I can see numbers formatted with up to 16 significant digits
- [x] As a user, I can see very large or small numbers displayed in exponential notation

### Keyboard Support

- [x] As a user, I can type digits 0-9 on the keyboard
- [x] As a user, I can type hex digits a-f when in Programmer HEX mode
- [x] As a user, I can type +, -, *, / for arithmetic operators
- [x] As a user, I can press Enter or = to evaluate
- [x] As a user, I can press Escape to clear
- [x] As a user, I can press Backspace to delete the last digit
- [x] As a user, I can press Delete to clear entry
- [x] As a user, I can press % for percentage
- [x] As a user, I can press F9 to negate the value
- [x] As a user, I can type ( and ) for parentheses in Scientific mode

### Menu System

- [x] As a user, I can open menus by clicking on the menu bar
- [x] As a user, I can hover between open menus to switch them
- [x] As a user, I can click outside the menu to close it
- [x] As a user, I can see an About dialog via Help > About Calculator

### User Interface

- [x] As a user, I can see themed visual styles matching the current desktop skin
- [x] As a user, I can see distinct visual styling for digit buttons, operator buttons, scientific buttons, and programmer buttons
- [ ] As a user, I can see a calculation history panel showing previous expressions and results
- [ ] As a user, I can copy the display value to the clipboard with Ctrl+C
- [ ] As a user, I can paste a value from the clipboard with Ctrl+V
- [ ] As a user, I can see a "Digit grouping" option to toggle thousands separators
- [ ] As a user, I can see a "Statistics" mode for basic statistical calculations
- [ ] As a user, I can see a "Unit Conversion" mode for length, weight, temperature, etc.
`})();
