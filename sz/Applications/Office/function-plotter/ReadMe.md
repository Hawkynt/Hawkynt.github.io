# Function Plotter

A mathematical function plotting application for the »SynthelicZ« desktop with expression parsing, syntax highlighting, autocomplete, parametric curve families, and Kurvendiskussion-style analysis. It supports 42+ math functions and renders interactive, zoomable, pannable plots with real-time curve tracing.

## Product Requirements

### Purpose
The Function Plotter brings a full-featured graphing calculator experience to the »SynthelicZ« desktop, allowing users to visualize mathematical functions, explore parametric curve families, and perform automated curve analysis (Kurvendiskussion). It serves students, educators, and anyone who needs to quickly plot and analyze mathematical expressions without installing a native application.

### Key Capabilities
- Multi-function plotting with distinct colors on an interactive, zoomable, pannable coordinate system
- Rich expression language with 42+ functions including trigonometric, hyperbolic, logarithmic, and rounding functions plus implicit multiplication
- Parametric curve families using a t-parameter with configurable range and step count
- Automated Kurvendiskussion analysis: roots, extrema, inflection points, saddle points, monotonicity, discontinuities, and limits
- Autocomplete with function descriptions and syntax-highlighted expression editing with error position marking
- Real-time curve tracing with coordinate tooltips snapping to the nearest curve
- PNG export at 2x resolution

### Design Reference
Inspired by desktop graphing tools such as GeoGebra and the TI-84 graphing calculator interface, with additional curve analysis features drawn from the German mathematical tradition of Kurvendiskussion.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### Core Plotting
- [x] As a user, I can enter mathematical expressions and see them plotted on a coordinate system
- [x] As a user, I can add multiple functions and see them plotted simultaneously with distinct colors
- [x] As a user, I can enable or disable individual functions to show/hide their curves
- [x] As a user, I can delete functions from the list
- [x] As a user, I can replot all functions on demand
- [x] As a user, I can see a grid with major and minor lines on the coordinate plane
- [x] As a user, I can see axis labels with automatically scaled tick marks
- [x] As a user, I can see a legend panel listing all plotted functions with their colors

### Expression Language
- [x] As a user, I can use standard arithmetic operators (+, -, *, /, ^, **)
- [x] As a user, I can use trigonometric functions (sin, cos, tan, cot, csc, sec)
- [x] As a user, I can use inverse trigonometric functions (asin, acos, atan, atan2, acot, acsc, asec)
- [x] As a user, I can use hyperbolic functions (sinh, cosh, tanh, coth, csch, sech)
- [x] As a user, I can use inverse hyperbolic functions (asinh, acosh, atanh, acoth, acsch, asech)
- [x] As a user, I can use logarithmic functions (log, log10, log2, logn)
- [x] As a user, I can use rounding functions (floor, ceil, trunc, round with mode parameter)
- [x] As a user, I can use utility functions (abs, sign, pow, sqrt, cbrt, exp, hypot)
- [x] As a user, I can use constants pi and e in expressions
- [x] As a user, I can use function aliases (ceiling, truncate, arsinh, etc.)
- [x] As a user, I can use implicit multiplication (e.g., 2x instead of 2*x)

### Parametric Families
- [x] As a user, I can use a parameter "t" in expressions to create curve families
- [x] As a user, I can specify the parameter range (from, to) and step count for t
- [x] As a user, I can see all curves in a family plotted with color variations
- [x] As a user, I can see t-value labels on each curve in a family
- [x] As a user, I can click on a specific curve in a family to select it for analysis

### Autocomplete and Editing
- [x] As a user, I can see autocomplete suggestions as I type function names
- [x] As a user, I can navigate autocomplete suggestions with keyboard arrows and select with Enter/Tab
- [x] As a user, I can see function descriptions and domain information in autocomplete items
- [x] As a user, I can see a tooltip with function info when my cursor is on a function name
- [x] As a user, I can see syntax-highlighted expressions in the function list
- [x] As a user, I can see parse error positions highlighted in the expression

### Curve Analysis (Kurvendiskussion)
- [x] As a user, I can see automatically computed roots (zeros) of the function
- [x] As a user, I can see the y-intercept value
- [x] As a user, I can see local extrema (maxima and minima) with coordinates
- [x] As a user, I can see inflection points with coordinates
- [x] As a user, I can see saddle points with coordinates
- [x] As a user, I can see monotonicity intervals (increasing/decreasing)
- [x] As a user, I can see discontinuities and poles marked with dashed vertical lines
- [x] As a user, I can see limits as x approaches positive and negative infinity
- [x] As a user, I can see symbolic polynomial form and derivatives when applicable
- [x] As a user, I can see analysis markers (dots) on the plot at roots, extrema, and inflection points
- [x] As a user, I can hover over markers to see their coordinates in a tooltip

### Navigation and Zoom
- [x] As a user, I can pan the view by dragging on the canvas
- [x] As a user, I can zoom in and out using the mouse wheel at the cursor position
- [x] As a user, I can zoom in and out via menu commands and keyboard shortcuts
- [x] As a user, I can reset the view to the default viewport
- [x] As a user, I can see the current zoom percentage in the status bar

### Tracing and Interaction
- [x] As a user, I can see real-time coordinate values as I move the mouse over the plot
- [x] As a user, I can see a trace tooltip snapping to the nearest curve with x, y, and t values
- [x] As a user, I can click on a curve to select it and trigger analysis for that specific function
- [x] As a user, I can see the selected curve drawn thicker than non-selected curves

### Export
- [x] As a user, I can export the plot as a PNG image at 2x resolution

### View Options
- [x] As a user, I can toggle grid visibility
- [x] As a user, I can toggle axis label visibility
- [x] As a user, I can switch between light and dark mode

### Keyboard Shortcuts
- [x] As a user, I can use Ctrl+N to clear all functions
- [x] As a user, I can use Ctrl+Shift+N to add a new function
- [x] As a user, I can use Ctrl+Enter to replot all functions
- [x] As a user, I can use Ctrl+E to export as PNG
- [x] As a user, I can use Ctrl+0 to reset the view
- [x] As a user, I can use Ctrl++/- to zoom in/out

### User Interface
- [x] As a user, I can see the coordinate position in the status bar
- [x] As a user, I can see the function count in the status bar
- [x] As a user, I can use a menu bar with Function, View, and Help menus
- [x] As a user, I can see a keyboard shortcuts reference dialog
- [x] As a user, I can see an About dialog

### Aspirational Features
- [ ] As a user, I want to save and load function sets to/from files
- [ ] As a user, I want to define piecewise functions
- [ ] As a user, I want to plot polar coordinate functions (r = f(theta))
- [ ] As a user, I want to plot parametric curves (x(t), y(t))
- [ ] As a user, I want to compute definite integrals between two x-values with area shading
- [ ] As a user, I want to see the derivative curve plotted alongside the original function
- [ ] As a user, I want to add annotations and text labels to the plot
- [ ] As a user, I want to animate parameter t over time to see curve family evolution
